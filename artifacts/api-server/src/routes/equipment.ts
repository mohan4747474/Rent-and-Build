import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z, ZodError } from "zod";
import { CreateEquipmentListingBody } from "@workspace/api-zod";
import { execute, query } from "@workspace/db";
import { requireAuth, requireRoles, type AuthRequest } from "../middlewares/auth";

const router = Router();

const equipmentInput = CreateEquipmentListingBody.extend({
  name: z.string().trim().min(2).max(255),
  vehicleNumber: z.string().trim().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9 -]*$/),
  dailyRate: z.number().finite().positive().max(100_000_000),
});
const duplicateEquipmentMessage = "Vehicle already registered or details already present. Please change the details.";

function normalizedVehicleNumber(value: string) {
  return value.trim().replace(/[ -]/g, "").toUpperCase();
}

function isOracleUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "errorNum" in error && error.errorNum === 1;
}

const equipmentColumns = `
  e.id AS "id",
  e.name AS "name",
  e.category AS "type",
  e.vehicle_number AS "vehicleNumber",
  e.rc_card_number AS "rcCardNumber",
  e.city AS "city",
  e.daily_rate AS "price",
  u.name AS "owner",
  u.email AS "ownerEmail",
  e.owner_phone AS "ownerPhone",
  e.operator_name AS "operatorName",
  e.operator_phone AS "operatorPhone",
  e.operator_experience AS "operatorExperience",
  e.working_hours AS "workingHours",
  e.km_driven AS "kmDriven",
  e.sensors_working AS "sensorsWorking"`;

router.get("/", async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT ${equipmentColumns}
       FROM equipment e
       JOIN users u ON u.id = e.owner_id
       WHERE e.available = 1 AND e.deleted_at IS NULL AND u.deleted_at IS NULL
       ORDER BY e.created_at DESC`,
    );
    return res.json({ equipment: rows.map(mapEquipment) });
  } catch (error) {
    return next(error);
  }
});

router.get("/mine", requireAuth, requireRoles("owner", "admin"), async (req: AuthRequest, res, next) => {
  try {
    const rows = await query(
      `SELECT ${equipmentColumns}
       FROM equipment e
       JOIN users u ON u.id = e.owner_id
       WHERE e.owner_id = :ownerId AND e.deleted_at IS NULL
       ORDER BY e.created_at DESC`,
      { ownerId: req.user!.id },
    );
    return res.json({ equipment: rows.map(mapEquipment) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAuth, requireRoles("owner", "admin"), async (req: AuthRequest, res, next) => {
  try {
    const input = equipmentInput.parse(req.body);
    const [owner] = await query<{ phone: string }>(
      `SELECT phone AS "phone" FROM users
       WHERE id = :ownerId AND deleted_at IS NULL`,
      { ownerId: req.user!.id },
    );
    if (!owner) return res.status(401).json({ error: "Owner account is no longer available" });
    if (owner.phone !== input.ownerPhone) {
      return res.status(400).json({ error: "Owner phone must match the phone on the signed-in account" });
    }
    const [existingVehicle] = await query<{ id: string }>(
      `SELECT id AS "id" FROM equipment
       WHERE REPLACE(REPLACE(UPPER(TRIM(vehicle_number)), ' ', ''), '-', '') = :vehicleNumber`,
      { vehicleNumber: normalizedVehicleNumber(input.vehicleNumber) },
    );
    if (existingVehicle) return res.status(409).json({ error: duplicateEquipmentMessage });

    const id = randomUUID();
    await execute(
      `INSERT INTO equipment (
         id, owner_id, name, category, vehicle_number, license_number,
         rc_card_number, city, description, hourly_rate, daily_rate,
         working_hours, odometer_km, km_driven, owner_phone,
         operator_name, operator_phone, operator_experience,
         sensors_working, available
       ) VALUES (
         :id, :ownerId, :name, :category, :vehicleNumber, :licenseNumber,
         :rcCardNumber, :city, :description, :hourlyRate, :dailyRate,
         :workingHours, 0, :kmDriven, :ownerPhone,
         :operatorName, :operatorPhone, :operatorExperience,
         :sensorsWorking, 1
       )`,
      {
        id,
        ownerId: req.user!.id,
        ...input,
        description: `${input.name} available for rent in ${input.city}.`,
        hourlyRate: input.dailyRate / 8,
        ownerPhone: owner.phone,
        sensorsWorking: input.sensorsWorking ? 1 : 0,
      },
    );
    const [equipment] = await query<Record<string, unknown>>(
      `SELECT ${equipmentColumns}
       FROM equipment e
       JOIN users u ON u.id = e.owner_id
       WHERE e.id = :id`,
      { id },
    );
    if (!equipment) throw new Error("Equipment listing was saved but could not be reloaded");
    return res.status(201).json({ equipment: mapEquipment(equipment) });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message ?? "Invalid equipment listing" });
    }
    if (isOracleUniqueConstraintError(error)) {
      const [existingVehicle] = await query<{ id: string }>(
        `SELECT id AS "id" FROM equipment
         WHERE REPLACE(REPLACE(UPPER(TRIM(vehicle_number)), ' ', ''), '-', '') = :vehicleNumber`,
        { vehicleNumber: normalizedVehicleNumber(String(req.body?.vehicleNumber ?? "")) },
      );
      if (existingVehicle) return res.status(409).json({ error: duplicateEquipmentMessage });
    }
    return next(error);
  }
});

function mapEquipment(row: Record<string, unknown>) {
  return {
    ...row,
    price: Number(row.price),
    workingHours: Number(row.workingHours),
    kmDriven: Number(row.kmDriven),
    sensorsWorking: Number(row.sensorsWorking) === 1,
    rating: "New",
    reviews: 0,
    image: imageForCategory(String(row.type)),
    tag: "New listing",
    available: "Today",
    operatorIncluded: true,
  };
}

function imageForCategory(category: string) {
  switch (category) {
    case "Dump truck": return "dump";
    case "Crane": return "crane";
    case "Loader": return "loader";
    case "Generator": return "generator";
    default: return "excavator";
  }
}

export default router;
