# AGENTS.md

Guide for AI coding agents working in the Rent-and-Build codebase.

## Quick Start

**Essential Commands:**
- `pnpm run start:api` — run the API server (port 5000)
- `pnpm run start:dev` — run the web frontend dev server (Vite, port 5173)
- `pnpm run build` — typecheck all packages, then build (required before commit)
- `pnpm run typecheck` — full TypeScript check across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec

**Environment Setup:**
Copy `.env.example` to `.env.local` and set `ORACLE_USER`, `ORACLE_PASSWORD`, and `ORACLE_CONNECT_STRING` for the local Oracle database.

## Repository Structure

This is a pnpm monorepo with packages organized in two directories:

### `/artifacts` — Deployable Services

- **`api-server`** — Express.js backend (Node.js 24, CommonJS bundle via esbuild)
  - Routes: `/api/auth`, `/api/payments`, `/api/tracking`, `/api/bookings`, `/api/healthz`
  - Authentication: Clerk + JWT tokens
  - Database: Oracle Database via node-oracledb (from `@workspace/db`)
  - Logging: Pino with structured JSON output
  - Security: Helmet, CORS, rate limiting (300 req/15min)

- **`rentbuild-india`** — React web app (Vite + TypeScript, deployed as static SPA)
  - UI Framework: React 19 + TailwindCSS + shadcn/ui (Radix UI primitives)
  - Forms: React Hook Form + Zod validation
  - Routing: Wouter (lightweight client-side router)
  - Server State: React Query for API calls
  - Authentication: Clerk SDK
  - Real-time: Framer Motion for animations, Recharts for dashboards

- **`mockup-sandbox`** — Storybook-like UI component preview (uses `@replit/vite-plugin-cartographer`)

### `/lib` — Shared Libraries

- **`db`** — Oracle Database pool and parameterized query helpers
  - Apply schema once with SQL Developer or SQLcl using `lib/db/schema.sql`
  - Key file: `src/index.ts` (connection pool and query helpers)

- **`api-spec`** — OpenAPI/Swagger spec (YAML) + Orval code generator
  - Source of truth: `openapi.yaml` (title must be "Api" for export paths to work)
  - Regenerate with: `pnpm --filter @workspace/api-spec run codegen`
  - Outputs generated code to `api-client-react` and `api-zod`

- **`api-client-react`** — Generated React Query hooks + Zod schemas from OpenAPI
  - Exports: All generated hooks, types, and Zod schemas
  - Do not edit this directly — regenerate from `api-spec`
  - Custom fetch: Uses auth token getter + base URL config

- **`api-zod`** — Generated Zod schemas from OpenAPI
  - Shared between backend and frontend for type safety
  - Do not edit this directly — regenerate from `api-spec`

## Architecture & Data Flow

### API-First Design

1. **Update OpenAPI spec** (`lib/api-spec/openapi.yaml`) with new endpoints or schemas
2. **Run codegen** (`pnpm --filter @workspace/api-spec run codegen`) to regenerate:
   - React Query hooks in `api-client-react/src/generated/`
   - Zod schemas in `api-zod/src/generated/`
3. **Implement backend** in `api-server/src/routes/` using Zod for validation
4. **Use frontend** hooks from `@workspace/api-client-react` in React components

### Authentication

- **Clerk** is the primary auth provider (handles signup, login, token management)
- **JWT tokens** are used for API calls (Bearer token in Authorization header)
- Clerk middleware at `api-server/src/middlewares/clerkProxyMiddleware.ts` proxies Clerk's JWKS
- Frontend: Use `useAuth()` from Clerk SDK to get the token (handled automatically by custom-fetch)
- Routes marked with `security: [{ bearerAuth: [] }]` in OpenAPI require authentication

### Database Schema Patterns

The Oracle DDL source of truth is `lib/db/schema.sql`. Tables use 36-character UUID strings, `TIMESTAMP WITH TIME ZONE` audit fields, and foreign keys for relationships. Apply schema changes with SQL Developer or SQLcl.

## Key Patterns

### API Routes (Backend)

```typescript
// Patterns in api-server/src/routes/auth.ts, payment.ts, etc.
import { Router } from "express";
import { z } from "zod";
import { query } from "@workspace/db";

const router = Router();

// Validate input with Zod
const schema = z.object({ email: z.string().email(), password: z.string().min(8) });

router.post("/login", async (req, res, next) => {
  try {
    const input = schema.parse(req.body);
    const [user] = await query<{ id: string }>(
      'SELECT id AS "id" FROM users WHERE email = :email',
      { email: input.email },
    );
    return res.json({ accessToken: signAccessToken(user), user });
  } catch (error) {
    next(error);  // Express error handler will respond with JSON error
  }
});

export default router;
```

Key points:
- Validate all input with Zod (synchronous, type-safe)
- Access Oracle through `query()` and `execute()` from `@workspace/db`.
- Bind all runtime values by name (for example `:email`); never interpolate user input into SQL.
- Return structured JSON (`{ accessToken, user }`, `{ error: "..." }`)
- Pass errors to `next(error)` for centralized error handler (already wired in `app.ts`)
- Status codes: 201 (created), 400 (bad input), 401 (auth), 409 (conflict), 500 (error)

### React Components

```typescript
// Hook-based, using generated React Query hooks
import { useAuth } from "@clerk/react";
import { usePostBookingsCreate } from "@workspace/api-client-react";

function BookingForm() {
  const { getToken } = useAuth();
  const mutation = usePostBookingsCreate({
    onSuccess: (data) => { /* handle success */ }
  });

  const handleSubmit = async (data) => {
    // Custom fetch automatically attaches bearer token
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* React Hook Form handles form state */}
      {mutation.isPending && <div>Loading...</div>}
      {mutation.isError && <div>Error: {mutation.error?.message}</div>}
    </form>
  );
}
```

Key points:
- Use generated React Query hooks (always available via `@workspace/api-client-react`)
- Clerk SDK provides auth tokens automatically (custom-fetch integration)
- Use `isPending`, `isError`, `data` from mutation/query result
- Forms with React Hook Form for state management

### Database Queries (Oracle)

```typescript
import { query, execute } from "@workspace/db";

const [user] = await query<{ id: string }>(
  'SELECT id AS "id" FROM users WHERE email = :email',
  { email },
);
await execute(
  "UPDATE bookings SET status = :status WHERE id = :bookingId",
  { status: "confirmed", bookingId },
);
```

Key points:
- Use Oracle bind variables (`:name`) for all runtime values; never interpolate user input into SQL.
- Select queries return arrays; destructure the first element with `[item]` for a single row.
- Soft deletes: update `deleted_at` and filter on `deleted_at IS NULL`.

### TypeScript & Validation

- Define result types for Oracle query rows with `query<T>()`.
- Zod validates at API boundaries (always call `.parse()` or `.parseAsync()`)
- Generated API client types come from OpenAPI spec → no manual typing needed for API responses
- Backend routes should validate with Zod before touching the DB

### Logging (Backend)

```typescript
import { logger } from "./lib/logger";

logger.info({ userId: id, action: "login" }, "User logged in");
logger.error({ error, requestId }, "Database query failed");
```

Pino logger outputs structured JSON. Log level defaults to `info` in production, controlled by `LOG_LEVEL` env var.

## Workflow

### Adding a New API Endpoint

1. **Update OpenAPI spec** (`lib/api-spec/openapi.yaml`):
   ```yaml
   /my-endpoint:
     post:
       tags: [my-feature]
       security: [{ bearerAuth: [] }]  # if auth required
       requestBody:
         required: true
         content:
           application/json:
             schema:
               $ref: "#/components/schemas/MyRequest"
       responses:
         "201": { description: Created }
   components:
     schemas:
       MyRequest:
         type: object
         required: [field1]
         properties:
           field1: { type: string }
   ```

2. **Regenerate code**: `pnpm --filter @workspace/api-spec run codegen`
   - Zod schemas appear in `lib/api-zod/src/generated/`
   - React Query hook appears in `lib/api-client-react/src/generated/`

3. **Implement backend route** in `api-server/src/routes/my-endpoint.ts`:
   ```typescript
   import { myRequestSchema } from "@workspace/api-zod";
   import { execute } from "@workspace/db";
   import { randomUUID } from "node:crypto";
   
   router.post("/my-endpoint", async (req, res, next) => {
     try {
       const input = myRequestSchema.parse(req.body);
       await execute(
         "INSERT INTO my_table (id, field1) VALUES (:id, :field1)",
         { id: randomUUID(), field1: input.field1 },
       );
       return res.status(201).json({ created: true });
     } catch (error) { next(error); }
   });
   ```

4. **Use in frontend** (React):
   ```typescript
   import { usePostMyEndpoint } from "@workspace/api-client-react";
   
   const mutation = usePostMyEndpoint();
   mutation.mutate({ field1: "value" });
   ```

### Modifying Database Schema

1. **Edit schema** in `lib/db/schema.sql`
2. **Apply the DDL** using SQL Developer or SQLcl while connected to Oracle.

### Building for Production

```bash
pnpm run build          # typecheck + build all
pnpm run package:web    # build + package web artifact to dist/
```

The `build` command runs `typecheck` first, so any TypeScript errors will block the build.

## Common Tasks

### Finding Types & Schemas

- **API request/response types**: Generated in `lib/api-zod/src/generated/types.ts`
- **Database row types**: Use `typeof table.$inferSelect` (e.g., `typeof users.$inferSelect`)
- **React Query hook types**: Look at `lib/api-client-react/src/generated/api.ts`

### Debugging API Calls

- Check browser DevTools Network tab for request/response
- Look at server logs (`pnpm run start:api` shows Pino logs)
- Use React Query DevTools browser extension to inspect cache
- Test with Bruno (API client in `build/` directory)

### Running Tests

No test runner is currently configured. Tests should be added following project conventions once adopted.

### Checking Types Without Building

```bash
pnpm run typecheck    # Quick TypeScript check across all packages
```

### Hot Reload During Development

- **Backend**: `pnpm run start:api` uses esbuild + Node, restarts on file changes
- **Frontend**: `pnpm run start:dev` uses Vite, instant HMR (no reload needed)

## Important Files & Conventions

| File/Directory | Purpose |
|---|---|
| `lib/api-spec/openapi.yaml` | Source of truth for API contract |
| `lib/db/schema.sql` | Oracle tables, constraints, and batch metadata schema |
| `artifacts/api-server/src/routes/` | API route implementations, one file per domain |
| `artifacts/rentbuild-india/src/App.tsx` | Main React app (stores app-level state) |
| `.env.example` | Template for required environment variables |
| `pnpm-workspace.yaml` | Workspace configuration, dependency catalog |
| `tsconfig.base.json` | Shared TypeScript settings |

### Naming Conventions

- Packages: `@workspace/<name>` (kebab-case)
- Routes: `/api/<domain>/<action>` (e.g., `/api/auth/login`, `/api/bookings/create`)
- Database tables: snake_case (e.g., `users`, `equipment_tracking`)
- TypeScript files: kebab-case for utilities/components, PascalCase for React components
- Environment variables: SCREAMING_SNAKE_CASE (e.g., `ORACLE_CONNECT_STRING`, `CLERK_PUBLISHABLE_KEY`)

### Code Style

- **Formatting**: Prettier is configured (`pnpm run format` if added)
- **TypeScript**: Strict mode enabled (`strict: true` in tsconfig.base.json, with some exceptions)
- **Imports**: ESM throughout (all packages use `"type": "module"`)
- **Error handling**: Always respond with JSON error objects, never plain text

## Gotchas & Edge Cases

### OpenAPI Spec Title

The OpenAPI spec title **must be "Api"** — the Orval generator uses this to generate exports. Changing it breaks import paths in `api-client-react` and `api-zod`.

### Oracle Query Results
The Oracle `query()` helper returns arrays; destructure the first element for a single row:
```typescript
const [user] = await db.select().from(users).limit(1);  // ✓ Correct
const user = await db.select().from(users).limit(1);    // ✗ Wrong (is an array)
```

### Soft Deletes

Queries on user tables should filter out soft-deleted rows:
```typescript
const activeUsers = await db.select().from(users)
  .where(isNull(users.deletedAt));  // Exclude soft-deleted
```

### Authentication Middleware

The Clerk middleware is applied globally in `app.ts`. If a route needs to be public, it will still have `req.auth` set (but it may be null). Check `if (!req.auth)` to enforce auth requirements.

### Date Handling

Oracle timestamps are returned as JavaScript Date objects. Use UTC in application code.

### Environment Variables

The API server requires `ORACLE_USER`, `ORACLE_PASSWORD`, and `ORACLE_CONNECT_STRING`. Other variables like `CLERK_PUBLISHABLE_KEY` are optional but authentication won't work without them. Check `.env.example` for required variables.

### React Query Mutation Names

Generated hook names follow the pattern: `use<Method><Path>` (e.g., `usePostAuthRegister`, `useGetTrackingCurrentEquipmentId`). Check `lib/api-client-react/src/generated/api.ts` to find the exact name.

### Workspace Package References

Internal packages are referenced with workspace protocol: `@workspace/db@workspace:*`. This means local changes are immediately reflected without reinstalling.

## Debugging & Troubleshooting

**Build fails with TypeScript errors**: Run `pnpm run typecheck` to see all errors across packages. Fix the highest-level package first (libraries before artifacts).

**API calls return 401 Unauthorized**: Check that Clerk is configured (env vars set), and the route is actually secured in the OpenAPI spec with `security: [{ bearerAuth: [] }]`.

**Database connection fails**: Ensure the Oracle listener is running on port 1521, service `XEPDB1` is available, and `ORACLE_USER`, `ORACLE_PASSWORD`, and `ORACLE_CONNECT_STRING` are set in `.env.local`.

**Generated code is out of date**: Run `pnpm --filter @workspace/api-spec run codegen` to regenerate from the OpenAPI spec. If changes don't appear, check that the spec file was saved and the title is still "Api".

**Frontend can't reach the API**: Check that both servers are running (`pnpm run start:api` and `pnpm run start:dev`). The frontend expects the API at `/api` relative to its host. For local development, ensure CORS is enabled in the API server (it is, but check `app.ts`).
