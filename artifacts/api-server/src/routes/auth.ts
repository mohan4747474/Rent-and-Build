import { Router } from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { execute, query } from "@workspace/db";
import { signAccessToken } from "../middlewares/auth";
import { deliverNotification } from "../lib/notifications";

const router = Router();
const credentials = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(10).max(20).optional(),
  role: z.enum(["customer", "owner", "operator"]).default("customer"),
});
const registrationCredentials = credentials.extend({
  password: z.string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
      message: "Password must include lowercase, uppercase, a number, and a special character",
    }),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, {
    message: "Phone must use international format with country code, e.g. +919876543210",
  }),
});

router.post("/register", async (req, res, next) => {
  try {
    const input = registrationCredentials.parse(req.body);
    if (!input.name || !input.phone) return res.status(400).json({ error: "Name and phone are required" });
    const [existing] = await query<{ id: string }>(
      'SELECT id AS "id" FROM users WHERE email = :email AND deleted_at IS NULL',
      { email: input.email },
    );
    if (existing) return res.status(409).json({ error: "Email is already registered" });
    const id = randomUUID();
    await execute(
      `INSERT INTO users (id, email, password_hash, name, phone, role)
       VALUES (:id, :email, :passwordHash, :name, :phone, :role)`,
      {
        id,
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        name: input.name,
        phone: input.phone,
        role: input.role,
      },
    );
    const user = { id, role: input.role };
    await deliverNotification(
      { email: input.email, phone: input.phone },
      "Welcome to RentBuild",
      `Welcome to RentBuild, ${input.name}! Your account is ready. You can now explore and book equipment.`,
    );
    return res.status(201).json({ accessToken: signAccessToken(user), user });
  } catch (error) { return next(error); }
});

router.post("/admin/login", async (req, res, next) => {
  try {
    const input = z.object({ userId: z.string().min(3).max(120), password: z.string().min(8) }).parse(req.body);
    const adminUserId = process.env.ADMIN_USER_ID ?? process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminUserId || !adminPassword || input.userId.trim().toLowerCase() !== adminUserId.trim().toLowerCase() || input.password !== adminPassword) {
      return res.status(401).json({ error: "Invalid administrator credentials" });
    }
    return res.json({
      accessToken: signAccessToken({ id: "configured-admin", role: "admin" }),
      user: { userId: adminUserId, role: "admin" },
    });
  } catch (error) { return next(error); }
});

router.post("/login", async (req, res, next) => {
  try {
    const input = credentials.pick({ email: true, password: true }).parse(req.body);
    const [user] = await query<{
      id: string;
      name: string;
      email: string;
      phone: string;
      role: "customer" | "owner" | "operator" | "admin";
      password_hash: string;
    }>(
      `SELECT id AS "id", name AS "name", email AS "email", phone AS "phone",
              role AS "role", password_hash AS "password_hash"
       FROM users WHERE email = :email AND deleted_at IS NULL`,
      { email: input.email },
    );
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    return res.json({
      accessToken: signAccessToken({ id: user.id, role: user.role }),
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (error) { return next(error); }
});

export default router;
