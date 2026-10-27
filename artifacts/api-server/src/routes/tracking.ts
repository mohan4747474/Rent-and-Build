import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { execute, query, transaction, type OracleBinds } from "@workspace/db";
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

const telemetryColumns = `
  equipment_id AS "equipmentId",
  latitude AS "latitude",
  longitude AS "longitude",
  speed_kph AS "speedKph",
  fuel_percent AS "fuelPercent",
  engine_on AS "engineOn",
  odometer_km AS "odometerKm",
  engine_hours AS "engineHours",
  ecu_data AS "ecuData",
  recorded_at AS "recordedAt"`;

function mapTelemetry(row: Record<string, unknown>) {
  const ecuData = typeof row.ecuData === "string" ? JSON.parse(row.ecuData) : row.ecuData;
  return {
    ...row,
    latitude: String(row.latitude),
    longitude: String(row.longitude),
    speedKph: String(row.speedKph),
    fuelPercent: String(row.fuelPercent),
    engineOn: row.engineOn === 1,
    engineHours: String(row.engineHours),
    ecuData,
  };
}

function accessFilter(
  role: "owner" | "operator" | "admin" | "customer",
  userId: string,
): { sql: string; binds: OracleBinds } {
  if (role === "admin") return { sql: "", binds: {} };
  if (role === "owner") {
    return {
      sql: " AND EXISTS (SELECT 1 FROM equipment e WHERE e.id = t.equipment_id AND e.owner_id = :userId)",
      binds: { userId },
    };
  }
  return {
    sql: " AND EXISTS (SELECT 1 FROM bookings b WHERE b.equipment_id = t.equipment_id AND b.customer_id = :userId)",
    binds: { userId },
  };
}

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
    const [owner] = await query<{
      email: string;
      phone: string;
      equipmentName: string;
      vehicleNumber: string;
    }>(
      `SELECT u.email AS "email", e.owner_phone AS "phone",
              e.name AS "equipmentName", e.vehicle_number AS "vehicleNumber"
       FROM equipment e
       JOIN users u ON u.id = e.owner_id
       WHERE e.id = :equipmentId AND e.deleted_at IS NULL`,
      { equipmentId: input.equipmentId },
    );
    if (!owner) return res.status(404).json({ error: "Equipment not found" });

    const telemetry = {
      equipmentId: input.equipmentId,
      latitude: input.latitude,
      longitude: input.longitude,
      speedKph: input.speedKph,
      fuelPercent: input.fuelPercent,
      engineOn: input.engineOn ? 1 : 0,
      odometerKm: input.odometerKm,
      engineHours: input.engineHours,
      ecuData: JSON.stringify(input.ecuData),
    };
    await transaction(async (connection) => {
      await execute(
        `INSERT INTO vehicle_telemetry_history
          (id, equipment_id, latitude, longitude, speed_kph, fuel_percent,
           engine_on, odometer_km, engine_hours, ecu_data)
         VALUES
          (:id, :equipmentId, :latitude, :longitude, :speedKph, :fuelPercent,
           :engineOn, :odometerKm, :engineHours, :ecuData)`,
        { id: randomUUID(), ...telemetry },
        connection,
      );
      await execute(
        `MERGE INTO vehicle_telemetry_current t
         USING (SELECT :equipmentId AS equipment_id FROM dual) s
         ON (t.equipment_id = s.equipment_id)
         WHEN MATCHED THEN UPDATE SET
           t.latitude = :latitude,
           t.longitude = :longitude,
           t.speed_kph = :speedKph,
           t.fuel_percent = :fuelPercent,
           t.engine_on = :engineOn,
           t.odometer_km = :odometerKm,
           t.engine_hours = :engineHours,
           t.ecu_data = :ecuData,
           t.recorded_at = SYSTIMESTAMP
         WHEN NOT MATCHED THEN INSERT
           (equipment_id, latitude, longitude, speed_kph, fuel_percent,
            engine_on, odometer_km, engine_hours, ecu_data)
         VALUES
           (:equipmentId, :latitude, :longitude, :speedKph, :fuelPercent,
            :engineOn, :odometerKm, :engineHours, :ecuData)`,
        telemetry,
        connection,
      );
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
    const filter = accessFilter(req.user!.role, req.user!.id);
    const [row] = await query(
      `SELECT ${telemetryColumns} FROM vehicle_telemetry_current t
       WHERE t.equipment_id = :equipmentId${filter.sql}`,
      { equipmentId: id, ...filter.binds },
    );
    if (!row) return res.status(404).json({ error: "No telemetry recorded for this equipment" });
    return res.json({ telemetry: mapTelemetry(row) });
  } catch (error) {
    return next(error);
  }
});

router.get("/history/:equipmentId", requireAuth, requireRoles("owner", "operator", "admin"), async (req: AuthRequest, res, next) => {
  try {
    const id = equipmentId.parse(req.params.equipmentId);
    const filter = accessFilter(req.user!.role, req.user!.id);
    const rows = await query(
      `SELECT ${telemetryColumns} FROM vehicle_telemetry_history t
       WHERE t.equipment_id = :equipmentId${filter.sql}
       ORDER BY t.recorded_at DESC FETCH FIRST 500 ROWS ONLY`,
      { equipmentId: id, ...filter.binds },
    );
    return res.json({ telemetry: rows.map(mapTelemetry) });
  } catch (error) {
    return next(error);
  }
});

export default router;
