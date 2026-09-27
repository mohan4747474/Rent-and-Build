# Build Guide - Rent and Build

This guide explains how to build, test, and deploy the Rent and Build application using both pnpm (Node.js) and Maven.

## Prerequisites

### Required Software
- **Node.js**: v24.0.0 or later
- **Maven**: 3.6.0 or later (for Maven-based builds)
- **Java**: JDK 11 or later (for Maven)
- **Docker** & **Docker Compose**: For running PostgreSQL and Datadog Agent locally

### Environment Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update `.env` with your configuration:
```env
DATABASE_URL=postgresql://rentbuild:rentbuild@localhost:5432/rentbuild
DD_API_KEY=your-datadog-api-key
```

3. Start PostgreSQL and Datadog Agent (optional for monitoring):
```bash
docker-compose -f docker-compose.dev.yml up -d
```

## Building with Maven

The project uses Maven as the primary build orchestrator for the entire Node.js-based monorepo.

### Clean Install

```bash
mvn clean install
```

**What this does:**
1. Cleans previous build artifacts (`node_modules/`, `dist/`, etc.)
2. Installs Node.js 24 and npm (via frontend-maven-plugin)
3. Installs pnpm globally
4. Installs all dependencies via `pnpm install`
5. Runs TypeScript type checking across all packages
6. Runs all tests (unit and integration)
7. Runs test coverage reports
8. Builds all packages
9. Reports success/failure

### Development Build

```bash
mvn clean install -P dev
```

Includes all of the above, plus starts development servers:
- API Server: `http://localhost:3000/api`
- Web Frontend: `http://localhost:5173`

### Production Build

```bash
mvn clean install -P prod
```

Optimized build for production deployment:
- TypeScript compilation
- Test execution with coverage
- Full build with optimizations
- Web artifact packaging to `dist/`

## Building with pnpm (Direct)

For faster iteration during development, you can use pnpm commands directly:

### Install Dependencies
```bash
pnpm install
```

### Type Checking
```bash
pnpm run typecheck
```

Check TypeScript compilation across all packages without building.

### Building

```bash
pnpm run build
```

Builds all packages (libraries and artifacts).

```bash
pnpm run build:web
```

Builds only the web frontend.

### Running Tests

#### All Tests
```bash
pnpm run test
```

Runs unit and integration tests for all packages that have a `test` script.

#### Specific Package Tests
```bash
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/rentbuild-india run test
```

#### Watch Mode (for development)
```bash
pnpm run test:watch
```

Auto-reruns tests when files change.

#### Test Coverage
```bash
pnpm run test:coverage
```

Generates coverage reports in `coverage/` directory for each package.

## Development Workflow

### Option 1: Maven (Recommended for CI/CD)

```bash
# Initial setup
mvn clean install

# Rebuild after code changes (skip tests for faster iteration)
mvn clean install -DskipTests

# Run specific phase
mvn clean test              # Clean and run tests
mvn clean package           # Clean and build
```

### Option 2: pnpm Direct (Recommended for local development)

```bash
# Install dependencies once
pnpm install

# Start API server (runs in terminal)
pnpm run start:api

# In another terminal, start frontend dev server
pnpm run start:dev

# Run tests when needed
pnpm run test:watch

# Typecheck on save
pnpm run typecheck
```

### Option 3: Hybrid (Best for rapid iteration)

```bash
# Initial Maven setup
mvn clean install

# Then use pnpm directly during development
pnpm run start:api &
pnpm run start:dev
```

## Test Coverage & Organization

### Backend Tests (API Server)

Located in: `artifacts/api-server/src/`

Test files:
- `src/routes/health.test.ts` - Integration tests for API endpoints
- `src/lib/logger.test.ts` - Unit tests for logging utilities

Run backend tests:
```bash
pnpm --filter @workspace/api-server run test
```

### Frontend Tests (React App)

Located in: `artifacts/rentbuild-india/src/`

Test files:
- `src/components/error-boundary.test.tsx` - Component unit tests
- `src/test/setup.ts` - Test environment configuration

Run frontend tests:
```bash
pnpm --filter @workspace/rentbuild-india run test
```

### Test Configuration

**Backend (Vitest):**
- Config file: `artifacts/api-server/vitest.config.ts`
- Environment: Node.js
- Coverage: V8

**Frontend (Vitest):**
- Config file: `artifacts/rentbuild-india/vitest.config.ts`
- Environment: jsdom
- Coverage: V8

## Datadog Integration

### APM Setup

**Backend (Node.js):**
- Initialized via `dd-trace` in `artifacts/api-server/src/index.ts`
- Service name: `rent-and-build-api`
- Traces automatically captured for:
  - Express endpoints
  - Database queries
  - HTTP calls
  - Errors

**Frontend (React):**
- Initialized via `@datadog/browser-rum` in React components
- Service name: `rent-and-build-web`
- Tracks:
  - User interactions
  - Page views
  - Performance metrics
  - Errors and logs

### Local Testing with Datadog Agent

Start the Datadog Agent locally:

```bash
docker-compose -f docker-compose.dev.yml up -d datadog-agent
```

Configure in `.env`:
```env
DD_AGENT_HOST=localhost
DD_AGENT_PORT=8126
DD_ENV=development
DD_API_KEY=test_key_do_not_use
```

The agent listens on:
- APM: `http://localhost:8126`
- StatsD: `localhost:8125/udp`

### Datadog Utilities

**Backend:**
```typescript
import { withDatadogSpan, setSpanTag, addSpanError } from '@workspace/api-server/lib/datadog';

// Wrap function with tracing
const tracedFn = withDatadogSpan(myFunction, 'my.operation');

// Add custom metrics
setSpanTag('user_id', userId);
setMetric('custom_latency', duration);
```

**Frontend:**
```typescript
import { initializeDatadog, logToDatadog, addRumAction } from '@workspace/rentbuild-india/lib/datadog';

// Initialize in main.tsx
initializeDatadog();

// Log to Datadog
logToDatadog('User login', 'info', { userId });

// Track custom actions
addRumAction('booking_created', { equipment_id });
```

## Troubleshooting

### Maven Build Issues

**Problem: `mvn clean install` fails with Node.js error**
```
Solution: Clear node_modules and npm cache
rm -rf node_modules ~/.npm
mvn clean install
```

**Problem: Tests timeout**
```
Solution: Increase test timeout in vitest config
mvn clean install -DtestTimeout=30000
```

**Problem: Network issues downloading dependencies**
```
Solution: Use offline mode after first install
mvn clean install -o
```

### pnpm Issues

**Problem: Dependency resolution errors**
```bash
pnpm install --force
```

**Problem: Workspace symlinks broken**
```bash
pnpm install --shamefully-hoist
```

### Test Failures

**Problem: Tests pass locally but fail in CI**
- Ensure `.env` is set correctly
- Check that PostgreSQL is running (`DATABASE_URL` must be valid)
- Verify Datadog API key if using APM features

**Problem: Flaky tests**
- Increase timeout in vitest config: `testTimeout: 10000`
- Check for timing issues in async tests
- Ensure tests don't depend on external services

### Port Conflicts

If port 3000 (API) or 5173 (Frontend) is already in use:

```bash
# Change API port
PORT=4000 pnpm run start:api

# Vite will auto-select another port if 5173 is taken
pnpm run start:dev
```

## CI/CD Integration

### GitHub Actions / GitLab CI

Use Maven for CI/CD builds:

```yaml
build:
  script:
    - mvn clean install -Pprod
    - mkdir -p artifacts/
    - cp -r dist/* artifacts/
```

### Docker Build

Create a Dockerfile:

```dockerfile
FROM node:24-alpine

WORKDIR /app
COPY . .

# Install Maven
RUN apk add --no-cache maven openjdk11

# Build with Maven
RUN mvn clean install -Pprod

# Start application
CMD ["pnpm", "run", "start:api"]
```

## Build Artifacts

After successful build, artifacts are located:

| Path | Contents |
|------|----------|
| `dist/` | Built web frontend (static files) |
| `artifacts/api-server/dist/` | Bundled API server (CommonJS) |
| `lib/*/dist/` | Built library packages |
| `coverage/` | Test coverage reports |

## Performance Optimization

### Skip Tests (Development Only)
```bash
mvn clean install -DskipTests
pnpm run build  # without test phase
```

### Incremental Build
Only rebuild changed packages:
```bash
pnpm run typecheck  # Check types only
pnpm --filter "@workspace/api-server" run build
```

### Parallel Build
Maven can build modules in parallel:
```bash
mvn clean install -T 4  # Use 4 threads
```

## Next Steps

- Read `AGENTS.md` for AI agent guidance
- See `replit.md` for deployment instructions
- Check individual package `package.json` for additional scripts
- Review `.env.example` for all available environment variables


