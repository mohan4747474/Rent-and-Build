import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

const audit = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const roleEnum = pgEnum("user_role", ["customer", "owner", "operator", "admin"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "requested", "payment_pending", "confirmed", "in_transit", "on_site", "completed", "cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", ["created", "authorized", "captured", "failed", "refunded"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  role: roleEnum("role").default("customer").notNull(),
  ...audit,
}, (table) => ({ emailIdx: index("users_email_idx").on(table.email) }));

export const equipment = pgTable("equipment", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  vehicleNumber: text("vehicle_number").notNull().unique(),
  licenseNumber: text("license_number").notNull(),
  rcCardNumber: text("rc_card_number").notNull(),
  city: text("city").notNull(),
  description: text("description").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 12, scale: 2 }).notNull(),
  dailyRate: decimal("daily_rate", { precision: 12, scale: 2 }).notNull(),
  workingHours: integer("working_hours").default(0).notNull(),
  odometerKm: integer("odometer_km").default(0).notNull(),
  kmDriven: integer("km_driven").default(0).notNull(),
  ownerPhone: text("owner_phone").notNull(),
  operatorName: text("operator_name").notNull(),
  operatorPhone: text("operator_phone").notNull(),
  operatorExperience: text("operator_experience").notNull(),
  sensorsWorking: boolean("sensors_working").default(false).notNull(),
  ecuDeviceId: text("ecu_device_id").unique(),
  available: boolean("available").default(true).notNull(),
  ...audit,
});

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").references(() => users.id).notNull(),
  equipmentId: uuid("equipment_id").references(() => equipment.id).notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  siteAddress: text("site_address").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  status: bookingStatusEnum("status").default("requested").notNull(),
  cancellationFeePaise: integer("cancellation_fee_paise"),
  refundAmountPaise: integer("refund_amount_paise"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  ...audit,
});

export const operators = pgTable("operators", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull().unique(),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  licenseNumber: text("license_number").notNull().unique(),
  active: boolean("active").default(true).notNull(),
  ...audit,
});

export const bookingWorkSessions = pgTable("booking_work_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
  operatorId: uuid("operator_id").references(() => operators.id).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  startOdometerKm: integer("start_odometer_km").notNull(),
  endOdometerKm: integer("end_odometer_km"),
  notes: text("notes"),
  ...audit,
});

export const operatorHistory = pgTable("operator_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  operatorId: uuid("operator_id").references(() => operators.id).notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id),
  action: text("action").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").references(() => users.id).notNull(),
  equipmentId: uuid("equipment_id").references(() => equipment.id).notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull().unique(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  ...audit,
});

export const favorites = pgTable("favorites", {
  customerId: uuid("customer_id").references(() => users.id).notNull(),
  equipmentId: uuid("equipment_id").references(() => equipment.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  favoritePk: primaryKey({ columns: [table.customerId, table.equipmentId] }),
  favoriteIdx: index("favorites_customer_equipment_idx").on(table.customerId, table.equipmentId),
}));

export const vehicleEngineSessions = pgTable("vehicle_engine_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  equipmentId: uuid("equipment_id").references(() => equipment.id).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  startOdometerKm: integer("start_odometer_km").notNull(),
  endOdometerKm: integer("end_odometer_km"),
  startEngineHours: decimal("start_engine_hours", { precision: 10, scale: 2 }).notNull(),
  endEngineHours: decimal("end_engine_hours", { precision: 10, scale: 2 }),
});

export const paymentTransactions = pgTable("payment_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id).notNull(),
  provider: text("provider").default("razorpay").notNull(),
  orderId: text("order_id").notNull().unique(),
  paymentId: text("payment_id").unique(),
  amountPaise: integer("amount_paise").notNull(),
  method: text("method"),
  status: paymentStatusEnum("status").default("created").notNull(),
  ...audit,
});

export const vehicleTelemetryCurrent = pgTable("vehicle_telemetry_current", {
  equipmentId: uuid("equipment_id").references(() => equipment.id).primaryKey(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  speedKph: decimal("speed_kph", { precision: 8, scale: 2 }).notNull(),
  fuelPercent: decimal("fuel_percent", { precision: 5, scale: 2 }).notNull(),
  engineOn: boolean("engine_on").notNull(),
  odometerKm: integer("odometer_km").notNull(),
  engineHours: decimal("engine_hours", { precision: 10, scale: 2 }).notNull(),
  ecuData: jsonb("ecu_data").$type<Record<string, number | string>>().notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
});

export const vehicleTelemetryHistory = pgTable("vehicle_telemetry_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  equipmentId: uuid("equipment_id").references(() => equipment.id).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  speedKph: decimal("speed_kph", { precision: 8, scale: 2 }).notNull(),
  fuelPercent: decimal("fuel_percent", { precision: 5, scale: 2 }).notNull(),
  engineOn: boolean("engine_on").notNull(),
  odometerKm: integer("odometer_km").notNull(),
  engineHours: decimal("engine_hours", { precision: 10, scale: 2 }).notNull(),
  ecuData: jsonb("ecu_data").$type<Record<string, number | string>>().notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  ...audit,
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});