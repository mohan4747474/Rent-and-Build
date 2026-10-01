import { Router } from "express";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { bookings, notifications, paymentTransactions, users } from "@workspace/db/schema";
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
    const [booking] = await db.select({ id: bookings.id }).from(bookings)
      .where(and(eq(bookings.id, input.bookingId), eq(bookings.customerId, req.user!.id)));
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    const order = await razorpay().orders.create({ amount: input.amountPaise, currency: "INR", receipt: input.bookingId });
    await db.insert(paymentTransactions).values({
      bookingId: input.bookingId,
      orderId: order.id,
      amountPaise: input.amountPaise,
    });
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
    const [payment] = await db.select({ bookingId: paymentTransactions.bookingId }).from(paymentTransactions)
      .innerJoin(bookings, eq(bookings.id, paymentTransactions.bookingId))
      .where(and(eq(paymentTransactions.orderId, input.orderId), eq(bookings.customerId, req.user!.id)));
    if (!payment) return res.status(404).json({ error: "Payment order not found" });
    await db.update(paymentTransactions).set({ paymentId: input.paymentId, status: "captured", updatedAt: new Date() })
      .where(eq(paymentTransactions.orderId, input.orderId));
    await db.update(bookings).set({ status: "confirmed", updatedAt: new Date() }).where(eq(bookings.id, payment.bookingId));
    const [customer] = await db.select({ email: users.email, phone: users.phone }).from(users)
      .innerJoin(bookings, eq(bookings.customerId, users.id)).where(eq(bookings.id, payment.bookingId));
    const message = `Payment for booking ${payment.bookingId} was captured successfully.`;
    await db.insert(notifications).values({ userId: req.user!.id, type: "payment.captured", title: "Payment successful", body: message });
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
