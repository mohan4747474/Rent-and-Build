import { randomUUID } from "node:crypto";
import {
  boolean,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  index,
  primaryKey,
} from "drizzle-orm/mysql-core";

const audit = {
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
};

const uuid = (name: string) => varchar(name, { length: 36 }).$defaultFn(() => randomUUID());

export const roleEnum = mysqlEnum("role", ["customer", "owner", "operator", "admin"]);
export const bookingStatusEnum = mysqlEnum("status", [
  "requested", "payment_pending", "confirmed", "in_transit", "on_site", "completed", "cancelled",
]);
export const paymentStatusEnum = mysqlEnum("status", ["created", "authorized", "captured", "failed", "refunded"]);

export const users = mysqlTable("users", {
  id: uuid("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: roleEnum.default("customer").notNull(),
  ...audit,
}, (table) => ({ emailIdx: index("users_email_idx").on(table.email) }));

export const equipment = mysqlTable("equipment", {
  id: uuid("id").primaryKey(),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  vehicleNumber: varchar("vehicle_number", { length: 64 }).notNull().unique(),
  licenseNumber: varchar("license_number", { length: 64 }).notNull(),
  rcCardNumber: varchar("rc_card_number", { length: 64 }).notNull(),
  city: text("city").notNull(),
  description: text("description").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 12, scale: 2 }).notNull(),
  dailyRate: decimal("daily_rate", { precision: 12, scale: 2 }).notNull(),
  workingHours: int("working_hours").default(0).notNull(),
  odometerKm: int("odometer_km").default(0).notNull(),
  kmDriven: int("km_driven").default(0).notNull(),
  ownerPhone: text("owner_phone").notNull(),
  operatorName: text("operator_name").notNull(),
  operatorPhone: text("operator_phone").notNull(),
  operatorExperience: text("operator_experience").notNull(),
  sensorsWorking: boolean("sensors_working").default(false).notNull(),
  ecuDeviceId: varchar("ecu_device_id", { length: 128 }).unique(),
  available: boolean("available").default(true).notNull(),
  ...audit,
});

export const bookings = mysqlTable("bookings", {
  id: uuid("id").primaryKey(),
  customerId: uuid("customer_id").references(() => users.id).notNull(),
  equipmentId: uuid("equipment_id").references(() => equipment.id).notNull(),
  startAt: timestamp("start_at", { mode: "date" }).notNull(),
  endAt: timestamp("end_at", { mode: "date" }).notNull(),
  siteAddress: text("site_address").notNull(),
  amountPaise: int("amount_paise").notNull(),
  status: bookingStatusEnum.default("requested").notNull(),
  cancellationFeePaise: int("cancellation_fee_paise"),
  refundAmountPaise: int("refund_amount_paise"),
  cancelledAt: timestamp("cancelled_at", { mode: "date" }),
  ...audit,
});

export const operators = mysqlTable("operators", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull().unique(),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  licenseNumber: varchar("license_number", { length: 64 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
  ...audit,
});

export const bookingWorkSessions = mysqlTable("booking_work_sessions", {
  id: uuid("id").primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
  operatorId: uuid("operator_id").references(() => operators.id).notNull(),
  startedAt: timestamp("started_at", { mode: "date" }).notNull(),
  endedAt: timestamp("ended_at", { mode: "date" }),
  startOdometerKm: int("start_odometer_km").notNull(),
  endOdometerKm: int("end_odometer_km"),
  notes: text("notes"),
  ...audit,
});

export const operatorHistory = mysqlTable("operator_history", {
  id: uuid("id").primaryKey(),
  operatorId: uuid("operator_id").references(() => operators.id).notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  action: text("action").notNull(),
  occurredAt: timestamp("occurred_at", { mode: "date" }).defaultNow().notNull(),
});

export const reviews = mysqlTable("reviews", {
  id: uuid("id").primaryKey(),
  customerId: uuid("customer_id").references(() => users.id).notNull(),
  equipmentId: uuid("equipment_id").references(() => equipment.id).notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull().unique(),
  rating: int("rating").notNull(),
  comment: text("comment").notNull(),
  ...audit,
});

export const favorites = mysqlTable("favorites", {
  customerId: uuid("customer_id").references(() => users.id).notNull(),
  equipmentId: uuid("equipment_id").references(() => equipment.id).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => ({
  favoritePk: primaryKey({ columns: [table.customerId, table.equipmentId] }),
  favoriteIdx: index("favorites_customer_equipment_idx").on(table.customerId, table.equipmentId),
}));

export const vehicleEngineSessions = mysqlTable("vehicle_engine_sessions", {
  id: uuid("id").primaryKey(),
  equipmentId: uuid("equipment_id").references(() => equipment.id).notNull(),
  startedAt: timestamp("started_at", { mode: "date" }).notNull(),
  endedAt: timestamp("ended_at", { mode: "date" }),
  startOdometerKm: int("start_odometer_km").notNull(),
  endOdometerKm: int("end_odometer_km"),
  startEngineHours: decimal("start_engine_hours", { precision: 10, scale: 2 }).notNull(),
  endEngineHours: decimal("end_engine_hours", { precision: 10, scale: 2 }),
});

export const paymentTransactions = mysqlTable("payment_transactions", {
  id: uuid("id").primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
  provider: text("provider").default("razorpay").notNull(),
  orderId: varchar("order_id", { length: 128 }).notNull().unique(),
  paymentId: varchar("payment_id", { length: 128 }).unique(),
  amountPaise: int("amount_paise").notNull(),
  method: text("method"),
  status: paymentStatusEnum.default("created").notNull(),
  ...audit,
});

export const vehicleTelemetryCurrent = mysqlTable("vehicle_telemetry_current", {
  equipmentId: uuid("equipment_id").references(() => equipment.id).primaryKey(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  speedKph: decimal("speed_kph", { precision: 8, scale: 2 }).notNull(),
  fuelPercent: decimal("fuel_percent", { precision: 5, scale: 2 }).notNull(),
  engineOn: boolean("engine_on").notNull(),
  odometerKm: int("odometer_km").notNull(),
  engineHours: decimal("engine_hours", { precision: 10, scale: 2 }).notNull(),
  ecuData: json("ecu_data").$type<Record<string, number | string>>().notNull(),
  recordedAt: timestamp("recorded_at", { mode: "date" }).defaultNow().notNull(),
});

export const vehicleTelemetryHistory = mysqlTable("vehicle_telemetry_history", {
  id: uuid("id").primaryKey(),
  equipmentId: uuid("equipment_id").references(() => equipment.id).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  speedKph: decimal("speed_kph", { precision: 8, scale: 2 }).notNull(),
  fuelPercent: decimal("fuel_percent", { precision: 5, scale: 2 }).notNull(),
  engineOn: boolean("engine_on").notNull(),
  odometerKm: int("odometer_km").notNull(),
  engineHours: decimal("engine_hours", { precision: 10, scale: 2 }).notNull(),
  ecuData: json("ecu_data").$type<Record<string, number | string>>().notNull(),
  recordedAt: timestamp("recorded_at", { mode: "date" }).defaultNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { mode: "date" }),
  ...audit,
});

export const auditLogs = mysqlTable("audit_logs", {
  id: uuid("id").primaryKey(),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});