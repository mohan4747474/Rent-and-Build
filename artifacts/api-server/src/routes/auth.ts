import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signAccessToken } from "../middlewares/auth";

const router = Router();
const credentials = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(10).max(20).optional(),
  role: z.enum(["customer", "owner", "operator"]).default("customer"),
});

router.post("/register", async (req, res, next) => {
  try {
    const input = credentials.parse(req.body);
    if (!input.name || !input.phone) return res.status(400).json({ error: "Name and phone are required" });
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
    if (existing) return res.status(409).json({ error: "Email is already registered" });
    const [user] = await db.insert(users).values({
      email: input.email, name: input.name, phone: input.phone,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: input.role,
    }).returning({ id: users.id, role: users.role });
    return res.status(201).json({ accessToken: signAccessToken(user), user });
  } catch (error) { next(error); }
});

router.post("/admin/login", async (req, res) => {
  const input = z.object({ email: z.string().email(), password: z.string().min(8) }).parse(req.body);
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || input.email.toLowerCase() !== adminEmail.toLowerCase() || input.password !== adminPassword) {
    return res.status(401).json({ error: "Invalid administrator credentials" });
  }
  return res.json({
    accessToken: signAccessToken({ id: "configured-admin", role: "admin" }),
    user: { email: adminEmail, role: "admin" },
  });
});

router.post("/login", async (req, res, next) => {
  try {
    const input = credentials.pick({ email: true, password: true }).parse(req.body);
    const [user] = await db.select().from(users).where(eq(users.email, input.email));
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    return res.json({
      accessToken: signAccessToken({ id: user.id, role: user.role }),
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (error) { next(error); }
});

export default router;
