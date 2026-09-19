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

## Local deployment

Copy `.env.example` to `.env`, set secrets, install dependencies with pnpm, and run the frontend
with `pnpm start`. The frontend is built once and served locally at `http://localhost:5173/`.
Start the API separately with `pnpm start:api`. Put TLS and security headers at an Azure
Application Gateway or Nginx edge in a hosted deployment. Send structured logs to Application
Insights and use Azure Service Bus for notification retries and telemetry ingestion.
