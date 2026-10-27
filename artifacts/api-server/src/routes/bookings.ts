import { Router } from "express";
import { z } from "zod";
import Razorpay from "razorpay";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { bookings, notifications, paymentTransactions, users } from "@workspace/db/schema";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { deliverNotification } from "../lib/notifications";

const router = Router();
const cancellableStatuses = ["requested", "payment_pending", "confirmed"] as const;

router.post("/:bookingId/cancel", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const bookingId = z.string().uuid().parse(req.params.bookingId);
    const cancellation = await db.transaction(async (tx) => {
      const [booking] = await tx.select({
        id: bookings.id,
        customerId: bookings.customerId,
        amountPaise: bookings.amountPaise,
        status: bookings.status,
      }).from(bookings)
        .where(and(eq(bookings.id, bookingId), eq(bookings.customerId, req.user!.id)))
        .for("update");
      if (!booking) return { notFound: true as const };
      if (!cancellableStatuses.includes(booking.status as (typeof cancellableStatuses)[number])) {
        return { conflict: true as const };
      }

      const cancellationFeePaise = Math.round(booking.amountPaise * 0.05);
      const refundAmountPaise = booking.amountPaise - cancellationFeePaise;
      const [payment] = await tx.select({ paymentId: paymentTransactions.paymentId })
        .from(paymentTransactions).where(eq(paymentTransactions.bookingId, bookingId));
      if (payment?.paymentId && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
        await razorpay.payments.refund(payment.paymentId, { amount: refundAmountPaise });
      }

      await tx.update(bookings).set({
        status: "cancelled",
        cancellationFeePaise,
        refundAmountPaise,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(bookings.id, bookingId));
      const [cancelled] = await tx.select().from(bookings).where(eq(bookings.id, bookingId));
      await tx.update(paymentTransactions).set({ status: "refunded", updatedAt: new Date() })
        .where(eq(paymentTransactions.bookingId, bookingId));
      return { booking, cancelled, cancellationFeePaise, refundAmountPaise };
    });

    if ("notFound" in cancellation) return res.status(404).json({ error: "Booking not found" });
    if ("conflict" in cancellation) {
      return res.status(409).json({ error: "This booking can no longer be cancelled" });
    }

    const { booking, cancelled, cancellationFeePaise, refundAmountPaise } = cancellation;
    const [customer] = await db.select({ email: users.email, phone: users.phone }).from(users).where(eq(users.id, booking.customerId));
    const message = `Booking ${bookingId} cancelled. A 5% cancellation charge of INR ${(cancellationFeePaise / 100).toFixed(2)} was applied. Refund: INR ${(refundAmountPaise / 100).toFixed(2)}.`;
    await db.insert(notifications).values({
      userId: booking.customerId,
      type: "booking.cancelled",
      title: "Booking cancelled",
      body: message,
    });
    await db.insert(notifications).values({
      userId: booking.customerId,
      type: "payment.refund",
      title: "Refund initiated",
      body: `Your refund of INR ${(refundAmountPaise / 100).toFixed(2)} has been initiated.`,
    });
    await deliverNotification(customer, "Booking cancelled and refund initiated", message);
    return res.json({ booking: cancelled, cancellationFeePaise, refundAmountPaise });
  } catch (error) {
    return next(error);
  }
});

export default router;
