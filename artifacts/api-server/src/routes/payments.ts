import { Router } from "express";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();
const razorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new Error("Razorpay credentials are not configured");
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
};

router.post("/create-order", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({ bookingId: z.string().uuid(), amountPaise: z.number().int().positive() }).parse(req.body);
    const order = await razorpay().orders.create({ amount: input.amountPaise, currency: "INR", receipt: input.bookingId });
    return res.status(201).json({ order, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) { next(error); }
});

router.post("/verify", requireAuth, (req, res) => {
  const input = z.object({ orderId: z.string(), paymentId: z.string(), signature: z.string() }).parse(req.body);
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "").update(`${input.orderId}|${input.paymentId}`).digest("hex");
  if (expected.length !== input.signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature))) {
    return res.status(400).json({ error: "Payment signature verification failed" });
  }
  return res.json({ verified: true, status: "captured" });
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
