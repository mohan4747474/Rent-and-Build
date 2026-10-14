# Quick Start Guide

Get the Rent and Build application running in under 5 minutes.

## 1. Prerequisites

Ensure you have installed:
- **Node.js 24+** → [Download](https://nodejs.org/)
- **Maven 3.6+** → [Download](https://maven.apache.org/download.cgi)
- **PostgreSQL** → [Download](https://www.postgresql.org/download/) or use Docker
- **Git** → Already installed

## 2. Clone & Setup

```bash
# Clone the repository
git clone <repo-url>
cd Rent-and-Build

# Copy environment configuration
cp .env.example .env
```

## 3. Database Setup

### Option A: Docker (Easiest)
```bash
docker run --name rentbuild-postgres -e POSTGRES_PASSWORD=rentbuild -e POSTGRES_DB=rentbuild -p 5432:5432 -d postgres:16-alpine
```

### Option B: Local PostgreSQL
Create a database:
```sql
CREATE USER rentbuild WITH PASSWORD 'rentbuild';
CREATE DATABASE rentbuild OWNER rentbuild;
```

Then update `.env`:
```env
DATABASE_URL=postgresql://rentbuild:rentbuild@localhost:5432/rentbuild
```

## 4. Build & Install

### With Maven (Recommended)
```bash
mvn clean install
```

This will:
- ✅ Install Node.js & pnpm
- ✅ Install all dependencies
- ✅ Run TypeScript checks
- ✅ Run all tests
- ✅ Build all packages

**Estimated time:** 5-10 minutes (first time), 2-3 minutes (subsequent)

### With pnpm (Faster for Development)
```bash
pnpm install
pnpm run build
pnpm run test
```

## 5. Start Development Servers

### Terminal 1 - API Server
```bash
pnpm run start:api
# Server running at http://localhost:3000/api
```

### Terminal 2 - Frontend
```bash
pnpm run start:dev
# Open http://localhost:5173 in your browser
```

## 6. Running Tests

```bash
# Run all tests
pnpm run test

# Run tests in watch mode (auto-restart on file changes)
pnpm run test:watch

# Generate coverage reports
pnpm run test:coverage
```

## 7. Common Commands

| Command | Purpose |
|---------|---------|
| `mvn clean install` | Full Maven build (clean + test + build) |
| `pnpm run build` | Build all packages |
| `pnpm run typecheck` | TypeScript type checking |
| `pnpm run test` | Run all tests once |
| `pnpm run test:watch` | Run tests in watch mode |
| `pnpm run start:api` | Start API server (port 3000) |
| `pnpm run start:dev` | Start web frontend (port 5173) |

## 8. Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:** Ensure PostgreSQL is running and `.env` has correct `DATABASE_URL`

### Port Already in Use
```bash
# Change port for API server
PORT=4000 pnpm run start:api

# Frontend auto-selects another port if 5173 is taken
pnpm run start:dev
```

### Dependency Issues
```bash
# Clear and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Tests Failing
```bash
# Check that DATABASE_URL is set correctly in .env
pnpm run test -- --reporter=verbose
```

## 9. Project Structure

```
Rent-and-Build/
├── artifacts/              # Deployable services
│   ├── api-server/        # Express.js backend
│   └── rentbuild-india/   # React frontend
├── lib/                    # Shared libraries
│   ├── db/                # PostgreSQL + Drizzle ORM
│   ├── api-spec/          # OpenAPI spec + codegen
│   ├── api-client-react/  # Generated React hooks
│   └── api-zod/           # Generated Zod schemas
├── pom.xml                # Maven build configuration
├── BUILD.md               # Detailed build guide
└── AGENTS.md              # AI agent guidance
```

## 10. Next Steps

- Read `BUILD.md` for detailed build instructions
- Check `AGENTS.md` for AI agent development guidance
- Review `replit.md` for deployment information
- See individual `README.md` files in each package for specific documentation

## 11. Getting Help

### API Documentation
- OpenAPI Spec: `lib/api-spec/openapi.yaml`
- API Routes: `artifacts/api-server/src/routes/`
- Postman/Bruno: Import `build/` directory

### Code Examples
- Backend: `artifacts/api-server/src/routes/auth.ts`
- Frontend: `artifacts/rentbuild-india/src/App.tsx`

### Development Resources
- Stack: Node.js 24, TypeScript 5.9, React 19, Vite, Express, PostgreSQL, Drizzle ORM
- Authentication: Clerk SDK
- UI Components: shadcn/ui (Radix UI)
- Testing: Vitest
- Monitoring: Datadog APM

## 12. Quick Sanity Check

After setup, verify everything works:

```bash
# Check Node/npm versions
node --version  # should be v24.x.x
pnpm --version

# Check Maven
mvn --version   # should be 3.6.0+

# Run tests
pnpm run test

# Start servers
pnpm run start:api &
pnpm run start:dev &

# Test API
curl http://localhost:3000/api/healthz
# Should return: {"status":"ok"}

# Open browser
open http://localhost:5173
# Should see Rent and Build interface
```

If all checks pass, you're ready to start developing! 🎉

---

**Need more help?** Check `BUILD.md` for comprehensive build documentation.

