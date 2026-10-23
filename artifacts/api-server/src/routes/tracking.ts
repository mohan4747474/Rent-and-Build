import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { vehicleTelemetryCurrent, vehicleTelemetryHistory, equipment, bookings, users } from "@workspace/db/schema";
import { and, desc, eq, exists, isNull } from "drizzle-orm";
import { requireAuth, requireRoles, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { deliverNotification } from "../lib/notifications";

const router = Router();
const equipmentId = z.string().uuid();
const telemetrySchema = z.object({
  equipmentId: z.string().uuid(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  speedKph: z.number().finite().min(0),
  fuelPercent: z.number().finite().min(0).max(100),
  engineOn: z.boolean(),
  odometerKm: z.number().int().nonnegative(),
  engineHours: z.number().finite().nonnegative(),
  ecuData: z.record(
    z.string(),
    z.union([z.string().max(60), z.number().finite()]),
  ),
});
const canAccessEquipment = (userId: string, role: "owner" | "operator" | "admin" | "customer", id: string) => role === "admin"
  ? exists(db.select({ id: equipment.id }).from(equipment).where(eq(equipment.id, id)))
  : role === "owner"
    ? exists(db.select({ id: equipment.id }).from(equipment).where(and(eq(equipment.id, id), eq(equipment.ownerId, userId))))
    : exists(db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.equipmentId, id), eq(bookings.customerId, userId))));

router.post("/telemetry", async (req, res, next) => {
  try {
    const expectedToken = process.env.TELEMETRY_INGEST_TOKEN;
    if (!expectedToken) {
      logger.error("Telemetry ingestion is disabled because TELEMETRY_INGEST_TOKEN is not configured");
      return res.status(503).json({ error: "Telemetry ingestion is not configured" });
    }
    const authorization = req.header("authorization") ?? "";
    const suppliedToken = authorization.replace(/^Bearer\s+/i, "");
    const suppliedDigest = crypto.createHash("sha256").update(suppliedToken).digest();
    const expectedDigest = crypto.createHash("sha256").update(expectedToken).digest();
    if (!crypto.timingSafeEqual(suppliedDigest, expectedDigest)) {
      return res.status(401).json({ error: "Invalid telemetry credentials" });
    }

    const input = telemetrySchema.parse(req.body);
    const [owner] = await db.select({
      email: users.email,
      phone: equipment.ownerPhone,
      equipmentName: equipment.name,
      vehicleNumber: equipment.vehicleNumber,
    }).from(equipment)
      .innerJoin(users, eq(users.id, equipment.ownerId))
      .where(and(eq(equipment.id, input.equipmentId), isNull(equipment.deletedAt)));
    if (!owner) return res.status(404).json({ error: "Equipment not found" });

    const recordedAt = new Date();
    const telemetry = {
      equipmentId: input.equipmentId,
      latitude: String(input.latitude),
      longitude: String(input.longitude),
      speedKph: String(input.speedKph),
      fuelPercent: String(input.fuelPercent),
      engineOn: input.engineOn,
      odometerKm: input.odometerKm,
      engineHours: String(input.engineHours),
      ecuData: input.ecuData,
      recordedAt,
    };
    await db.transaction(async (tx) => {
      await tx.insert(vehicleTelemetryHistory).values(telemetry);
      await tx.insert(vehicleTelemetryCurrent).values(telemetry).onConflictDoUpdate({
        target: vehicleTelemetryCurrent.equipmentId,
        set: {
          latitude: telemetry.latitude,
          longitude: telemetry.longitude,
          speedKph: telemetry.speedKph,
          fuelPercent: telemetry.fuelPercent,
          engineOn: telemetry.engineOn,
          odometerKm: telemetry.odometerKm,
          engineHours: telemetry.engineHours,
          ecuData: telemetry.ecuData,
          recordedAt: telemetry.recordedAt,
        },
      });
    });

    const ecuDetails = Object.entries(input.ecuData)
      .slice(0, 10)
      .map(([name, value]) => `${name.slice(0, 40)}: ${value}`)
      .join(", ") || "none reported";
    const message = [
      `Live sensor update for ${owner.equipmentName} (${owner.vehicleNumber})`,
      `Speed: ${input.speedKph} km/h`,
      `Fuel: ${input.fuelPercent}%`,
      `Engine: ${input.engineOn ? "on" : "off"}`,
      `Odometer: ${input.odometerKm} km`,
      `Engine hours: ${input.engineHours}`,
      `Location: ${input.latitude}, ${input.longitude}`,
      `ECU readings: ${ecuDetails}`,
    ].join("\n");
    await deliverNotification(
      { email: owner.email, phone: owner.phone },
      `Vehicle sensor update: ${owner.vehicleNumber}`,
      message,
    );
    return res.status(202).json({ received: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/current/:equipmentId", requireAuth, requireRoles("owner", "operator", "admin"), async (req: AuthRequest, res, next) => {
  try {
    const id = equipmentId.parse(req.params.equipmentId);
    const access = req.user && canAccessEquipment(req.user.id, req.user.role, id);
    const [telemetry] = await db.select().from(vehicleTelemetryCurrent).where(access ? and(eq(vehicleTelemetryCurrent.equipmentId, id), access) : eq(vehicleTelemetryCurrent.equipmentId, id));
    if (!telemetry) return res.status(404).json({ error: "No telemetry recorded for this equipment" });
    return res.json({ telemetry });
  } catch (error) { return next(error); }
});
router.get("/history/:equipmentId", requireAuth, requireRoles("owner", "operator", "admin"), async (req: AuthRequest, res, next) => {
  try {
    const id = equipmentId.parse(req.params.equipmentId);
    const access = req.user && canAccessEquipment(req.user.id, req.user.role, id);
    const telemetry = await db.select().from(vehicleTelemetryHistory)
      .where(access ? and(eq(vehicleTelemetryHistory.equipmentId, id), access) : eq(vehicleTelemetryHistory.equipmentId, id))
      .orderBy(desc(vehicleTelemetryHistory.recordedAt)).limit(500);
    return res.json({ telemetry });
  } catch (error) { return next(error); }
});

export default router;
