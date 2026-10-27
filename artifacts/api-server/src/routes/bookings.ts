import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import Razorpay from "razorpay";
import { execute, query, transaction } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { deliverNotification } from "../lib/notifications";

const router = Router();
const cancellableStatuses = ["requested", "payment_pending", "confirmed"] as const;
const bookingColumns = `
  b.id AS "id",
  b.customer_id AS "customerId",
  b.equipment_id AS "equipmentId",
  b.start_at AS "startAt",
  b.end_at AS "endAt",
  b.site_address AS "siteAddress",
  b.amount_paise AS "amountPaise",
  b.status AS "status",
  b.cancellation_fee_paise AS "cancellationFeePaise",
  b.refund_amount_paise AS "refundAmountPaise",
  b.cancelled_at AS "cancelledAt",
  b.created_at AS "createdAt",
  b.updated_at AS "updatedAt",
  b.deleted_at AS "deletedAt"`;

router.post("/:bookingId/cancel", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const bookingId = z.string().uuid().parse(req.params.bookingId);
    const cancellation = await transaction(async (connection) => {
      const [booking] = await query<{
        id: string;
        customerId: string;
        amountPaise: number;
        status: string;
      }>(
        `SELECT b.id AS "id", b.customer_id AS "customerId",
                b.amount_paise AS "amountPaise", b.status AS "status"
         FROM bookings b
         WHERE b.id = :bookingId AND b.customer_id = :customerId
         FOR UPDATE`,
        { bookingId, customerId: req.user!.id },
        connection,
      );
      if (!booking) return { notFound: true as const };
      if (!cancellableStatuses.includes(booking.status as (typeof cancellableStatuses)[number])) {
        return { conflict: true as const };
      }

      const cancellationFeePaise = Math.round(booking.amountPaise * 0.05);
      const refundAmountPaise = booking.amountPaise - cancellationFeePaise;
      const [payment] = await query<{ paymentId: string | null }>(
        `SELECT payment_id AS "paymentId"
         FROM payment_transactions WHERE booking_id = :bookingId`,
        { bookingId },
        connection,
      );
      if (payment?.paymentId && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
        await razorpay.payments.refund(payment.paymentId, { amount: refundAmountPaise });
      }

      await execute(
        `UPDATE bookings
         SET status = 'cancelled',
             cancellation_fee_paise = :cancellationFeePaise,
             refund_amount_paise = :refundAmountPaise,
             cancelled_at = SYSTIMESTAMP,
             updated_at = SYSTIMESTAMP
         WHERE id = :bookingId`,
        { bookingId, cancellationFeePaise, refundAmountPaise },
        connection,
      );
      const [cancelled] = await query(
        `SELECT ${bookingColumns} FROM bookings b WHERE b.id = :bookingId`,
        { bookingId },
        connection,
      );
      await execute(
        `UPDATE payment_transactions
         SET status = 'refunded', updated_at = SYSTIMESTAMP
         WHERE booking_id = :bookingId`,
        { bookingId },
        connection,
      );
      return { booking, cancelled, cancellationFeePaise, refundAmountPaise };
    });

    if ("notFound" in cancellation) return res.status(404).json({ error: "Booking not found" });
    if ("conflict" in cancellation) {
      return res.status(409).json({ error: "This booking can no longer be cancelled" });
    }

    const { booking, cancelled, cancellationFeePaise, refundAmountPaise } = cancellation;
    const [customer] = await query<{ email: string; phone: string }>(
      `SELECT email AS "email", phone AS "phone" FROM users WHERE id = :customerId`,
      { customerId: booking.customerId },
    );
    const message = `Booking ${bookingId} cancelled. A 5% cancellation charge of INR ${(cancellationFeePaise / 100).toFixed(2)} was applied. Refund: INR ${(refundAmountPaise / 100).toFixed(2)}.`;
    await execute(
      `INSERT INTO notifications (id, user_id, type, title, body)
       VALUES (:id, :userId, 'booking.cancelled', 'Booking cancelled', :body)`,
      { id: randomUUID(), userId: booking.customerId, body: message },
    );
    await execute(
      `INSERT INTO notifications (id, user_id, type, title, body)
       VALUES (:id, :userId, 'payment.refund', 'Refund initiated', :body)`,
      {
        id: randomUUID(),
        userId: booking.customerId,
        body: `Your refund of INR ${(refundAmountPaise / 100).toFixed(2)} has been initiated.`,
      },
    );
    await deliverNotification(customer, "Booking cancelled and refund initiated", message);
    return res.json({ booking: cancelled, cancellationFeePaise, refundAmountPaise });
  } catch (error) {
    return next(error);
  }
});

export default router;
