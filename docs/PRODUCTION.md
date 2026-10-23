# RENTBUILD INDIA

## Runtime

The web client is in `artifacts/rentbuild-india`; the API is in `artifacts/api-server`.
PostgreSQL is the production source of truth and the Drizzle schema in `lib/db/src/schema`
contains users, equipment, bookings, payments, notifications, audit records, and current/history
ECU telemetry. Use `pnpm --filter @workspace/db push` against a migration database before release.

## API

All routes are under `/api`. Authentication returns a seven-day JWT; send it as
`Authorization: Bearer <token>`. Protected fleet routes are restricted to owner, operator, and
admin roles. Administrative routes should use `requireRoles("admin")` when added to the console.

Payment flow: create the booking server-side, call `POST /payments/create-order`, open Razorpay
Checkout with the returned public key/order, then call `/payments/verify`. The webhook endpoint
must be configured in Razorpay and signed with `RAZORPAY_WEBHOOK_SECRET`. The receiving bank
information supplied for the business belongs in a private Razorpay/settlement configuration or
Azure Key Vault, never in frontend source, logs, or this repository.

Administrator credentials are separate from customer credentials. Set `ADMIN_USER_ID` and
`ADMIN_PASSWORD` only on the API server; never expose production administrator credentials as
`VITE_*` variables. The admin console provides overview, users, bookings, payments, fleet,
ECU sensors, and notification views.

Cancellation flow: call `POST /bookings/:bookingId/cancel` as the booking customer before the
booking enters transit. The API records a 5% cancellation charge, marks the payment refunded,
stores the net refund, and creates notification records.

## Email, SMS, and vehicle telemetry

The API sends welcome messages after registration, payment and cancellation messages, and vehicle
sensor updates to the equipment owner. Configure `RESEND_API_KEY` and a verified
`NOTIFICATION_FROM_EMAIL` for email, plus `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and
`TWILIO_FROM_NUMBER` for SMS. Recipient phone numbers must be in international format and enabled
to receive SMS. Ensure recipients have consented and comply with local messaging rules and
provider registration requirements. Keep provider credentials in the API server's secret store;
do not commit them.
If a provider is not configured or rejects a message, the API logs the channel failure and keeps
the completed account/payment/telemetry operation intact. Automatic notification retries are not
currently enabled.

Sensor devices can submit readings to `POST /tracking/telemetry` using
`Authorization: Bearer <TELEMETRY_INGEST_TOKEN>`. Set `TELEMETRY_INGEST_TOKEN` only on the API
server and configure each device to use it. Each accepted reading updates current telemetry,
adds a history row, and sends the listed sensor details to the equipment owner's email and
listing phone. Set the device reporting interval with notification volume and SMS costs in mind.
Example request:

```json
{
  "equipmentId": "00000000-0000-4000-8000-000000000000",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "speedKph": 18.5,
  "fuelPercent": 72,
  "engineOn": true,
  "odometerKm": 18230,
  "engineHours": 1120.5,
  "ecuData": { "oilPressure": 38.2, "coolantTemp": 86 }
}
```

## Local deployment

Copy `.env.example` to `.env`, set secrets, install dependencies with pnpm, and run the frontend
with `pnpm start`. The frontend is built once and served locally at `http://localhost:5173/`.
Start the API separately with `pnpm start:api`. Put TLS and security headers at an Azure
Application Gateway or Nginx edge in a hosted deployment. Send structured logs to Application
Insights. For production-scale telemetry, put an authenticated queue between devices and the API
to absorb bursts and provide durable delivery.
