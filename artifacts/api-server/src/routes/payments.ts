import { Router } from "express";
import crypto, { randomUUID } from "node:crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { execute, query, transaction } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { deliverNotification } from "../lib/notifications";

const router = Router();
const razorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new Error("Razorpay credentials are not configured");
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
};

router.post("/create-order", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({ bookingId: z.string().uuid(), amountPaise: z.number().int().positive() }).parse(req.body);
    const [booking] = await query<{ id: string }>(
      "SELECT id FROM bookings WHERE id = :bookingId AND customer_id = :customerId",
      { bookingId: input.bookingId, customerId: req.user!.id },
    );
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    const order = await razorpay().orders.create({ amount: input.amountPaise, currency: "INR", receipt: input.bookingId });
    await execute(
      `INSERT INTO payment_transactions
        (id, booking_id, order_id, amount_paise)
       VALUES (:id, :bookingId, :orderId, :amountPaise)`,
      {
        id: randomUUID(),
        bookingId: input.bookingId,
        orderId: order.id,
        amountPaise: input.amountPaise,
      },
    );
    return res.status(201).json({ order, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) { return next(error); }
});

router.post("/verify", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({ orderId: z.string(), paymentId: z.string(), signature: z.string() }).parse(req.body);
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "").update(`${input.orderId}|${input.paymentId}`).digest("hex");
    if (expected.length !== input.signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature))) {
      return res.status(400).json({ error: "Payment signature verification failed" });
    }
    const [payment] = await query<{ booking_id: string }>(
      `SELECT p.booking_id AS "booking_id"
       FROM payment_transactions p
       JOIN bookings b ON b.id = p.booking_id
       WHERE p.order_id = :orderId AND b.customer_id = :customerId`,
      { orderId: input.orderId, customerId: req.user!.id },
    );
    if (!payment) return res.status(404).json({ error: "Payment order not found" });
    const customer = await transaction(async (connection) => {
      await execute(
        `UPDATE payment_transactions
         SET payment_id = :paymentId, status = 'captured', updated_at = SYSTIMESTAMP
         WHERE order_id = :orderId`,
        { paymentId: input.paymentId, orderId: input.orderId },
        connection,
      );
      await execute(
        `UPDATE bookings SET status = 'confirmed', updated_at = SYSTIMESTAMP
         WHERE id = :bookingId`,
        { bookingId: payment.booking_id },
        connection,
      );
      const [row] = await query<{
        email: string;
        phone: string;
      }>(
        `SELECT u.email AS "email", u.phone AS "phone"
         FROM users u JOIN bookings b ON b.customer_id = u.id
         WHERE b.id = :bookingId`,
        { bookingId: payment.booking_id },
        connection,
      );
      await execute(
        `INSERT INTO notifications (id, user_id, type, title, body)
         VALUES (:id, :userId, 'payment.captured', 'Payment successful', :body)`,
        {
          id: randomUUID(),
          userId: req.user!.id,
          body: `Payment for booking ${payment.booking_id} was captured successfully.`,
        },
        connection,
      );
      return row;
    });
    const message = `Payment for booking ${payment.booking_id} was captured successfully.`;
    await deliverNotification(customer, "Payment successful", message);
    return res.json({ verified: true, status: "captured" });
  } catch (error) {
    return next(error);
  }
});

router.post("/webhook", (req, res) => {
  const signature = req.header("x-razorpay-signature");
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET ?? "").update(JSON.stringify(req.body)).digest("hex");
  if (!signature || expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }
  return res.status(202).json({ received: true });
});

export default router;
