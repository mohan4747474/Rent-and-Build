import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { vehicleTelemetryCurrent, vehicleTelemetryHistory } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth, requireRoles } from "../middlewares/auth";

const router = Router();
const equipmentId = z.string().uuid();
router.get("/current/:equipmentId", requireAuth, requireRoles("owner", "operator", "admin"), async (req, res, next) => {
  try {
    const id = equipmentId.parse(req.params.equipmentId);
    const [telemetry] = await db.select().from(vehicleTelemetryCurrent).where(eq(vehicleTelemetryCurrent.equipmentId, id));
    if (!telemetry) return res.status(404).json({ error: "No telemetry recorded for this equipment" });
    return res.json({ telemetry });
  } catch (error) { next(error); }
});
router.get("/history/:equipmentId", requireAuth, requireRoles("owner", "operator", "admin"), async (req, res, next) => {
  try {
    const id = equipmentId.parse(req.params.equipmentId);
    return res.json({ telemetry: await db.select().from(vehicleTelemetryHistory)
      .where(eq(vehicleTelemetryHistory.equipmentId, id)).orderBy(desc(vehicleTelemetryHistory.recordedAt)).limit(500) });
  } catch (error) { next(error); }
});

export default router;
