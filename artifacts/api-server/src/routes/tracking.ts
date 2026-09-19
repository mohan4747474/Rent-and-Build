import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { vehicleTelemetryCurrent, vehicleTelemetryHistory, equipment, bookings } from "@workspace/db/schema";
import { and, desc, eq, exists } from "drizzle-orm";
import { requireAuth, requireRoles } from "../middlewares/auth";

const router = Router();
const equipmentId = z.string().uuid();
const canAccessEquipment = (userId: string, role: string, id: string) => role === "admin"
  ? undefined
  : role === "owner"
    ? exists(db.select({ id: equipment.id }).from(equipment).where(and(eq(equipment.id, id), eq(equipment.ownerId, userId))))
    : exists(db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.equipmentId, id), eq(bookings.customerId, userId))));
router.get("/current/:equipmentId", requireAuth, requireRoles("owner", "operator", "admin"), async (req, res, next) => {
  try {
    const id = equipmentId.parse(req.params.equipmentId);
    const access = req.user && canAccessEquipment(req.user.id, req.user.role, id);
    const [telemetry] = await db.select().from(vehicleTelemetryCurrent).where(access ? and(eq(vehicleTelemetryCurrent.equipmentId, id), access) : eq(vehicleTelemetryCurrent.equipmentId, id));
    if (!telemetry) return res.status(404).json({ error: "No telemetry recorded for this equipment" });
    return res.json({ telemetry });
  } catch (error) { next(error); }
});
router.get("/history/:equipmentId", requireAuth, requireRoles("owner", "operator", "admin"), async (req, res, next) => {
  try {
    const id = equipmentId.parse(req.params.equipmentId);
    const access = req.user && canAccessEquipment(req.user.id, req.user.role, id);
    return res.json({ telemetry: await db.select().from(vehicleTelemetryHistory)
      .where(access ? and(eq(vehicleTelemetryHistory.equipmentId, id), access) : eq(vehicleTelemetryHistory.equipmentId, id)).orderBy(desc(vehicleTelemetryHistory.recordedAt)).limit(500) });
  } catch (error) { next(error); }
});

export default router;
