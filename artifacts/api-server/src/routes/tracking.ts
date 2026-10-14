import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { vehicleTelemetryCurrent, vehicleTelemetryHistory, equipment, bookings } from "@workspace/db/schema";
import { and, desc, eq, exists } from "drizzle-orm";
import { requireAuth, requireRoles, type AuthRequest } from "../middlewares/auth";

const router = Router();
const equipmentId = z.string().uuid();
const canAccessEquipment = (userId: string, role: "owner" | "operator" | "admin" | "customer", id: string) => role === "admin"
  ? exists(db.select({ id: equipment.id }).from(equipment).where(eq(equipment.id, id)))
  : role === "owner"
    ? exists(db.select({ id: equipment.id }).from(equipment).where(and(eq(equipment.id, id), eq(equipment.ownerId, userId))))
    : exists(db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.equipmentId, id), eq(bookings.customerId, userId))));
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
