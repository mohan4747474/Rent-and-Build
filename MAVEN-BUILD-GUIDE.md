# 🚀 Complete Maven Build Guide - Step by Step to Success

This guide walks you through building the Rent and Build project from start to finish.

## Overview

```
Your Machine
    ↓
Node.js v24, Java 11, Maven 3.6+
    ↓
mvn clean install
    ↓
Node.js → pnpm install → tsc → vitest → esbuild/vite
    ↓
✅ BUILD SUCCESS
```

**Expected Time:**
- First run: 5-10 minutes (downloads Node.js)
- Subsequent runs: 2-3 minutes
- With `-DskipTests`: 1-2 minutes

---

## 📋 Pre-Build: What You Need

### 1. System Requirements

Make sure you have:

```bash
# Check Node.js (need v24+)
node --version
# Output should be: v24.x.x or higher

# Check Java (need JDK 11+)
java -version
# Output should show: 11.x.x or higher

# Check Maven (need 3.6+)
mvn --version
# Output should show: Apache Maven 3.6.0 or higher

# Check Git (for version control)
git --version
```

**If anything is missing:** Install from:
- Node.js: https://nodejs.org/ (choose v24 LTS)
- Java JDK: https://www.oracle.com/java/technologies/downloads/ (choose JDK 11+)
- Maven: https://maven.apache.org/download.cgi (choose 3.9+)

### 2. Database Setup

You need PostgreSQL running. Choose one:

#### Option A: Docker (Recommended - No Installation)
```bash
# Start PostgreSQL in Docker
docker run -d --name rentbuild-postgres \
  -e POSTGRES_USER=rentbuild \
  -e POSTGRES_PASSWORD=rentbuild \
  -e POSTGRES_DB=rentbuild \
  -p 5432:5432 \
  postgres:16-alpine

# Verify it's running
docker ps | grep rentbuild-postgres
```

#### Option B: Local PostgreSQL (Already Installed)
```bash
# Verify PostgreSQL is running
psql --version

# Start the service (if not running)
# macOS: brew services start postgresql
# Linux: sudo service postgresql start
# Windows: Services → Start PostgreSQL

# Verify connection
psql -U rentbuild -d rentbuild -c "SELECT 1;"
```

### 3. Project Configuration

```bash
# Navigate to project
cd Rent-and-Build

# Copy environment file
cp .env.example .env

# Edit .env and ensure DATABASE_URL is set correctly
# For Docker: DATABASE_URL=postgresql://rentbuild:rentbuild@localhost:5432/rentbuild
# For local: DATABASE_URL=postgresql://rentbuild:password@localhost:5432/rentbuild
```

Edit `.env` file:
```env
DATABASE_URL=postgresql://rentbuild:rentbuild@localhost:5432/rentbuild
NODE_ENV=development
PORT=3000
```

---

## ✅ Step 1: Validate Setup (Recommended)

Before building, verify everything is correct:

### Windows Users:
```bash
validate-build.bat
```

### Mac/Linux Users:
```bash
bash validate-build.sh
```

**Expected Output:**
```
✓ Node.js v24.x.x found
✓ npm 10.x.x found
✓ Maven found
✓ Java found
✓ .env file found
✓ DATABASE_URL is set in .env
✓ pom.xml exists
✓ No critical errors found

You are ready to build!
```

**If there are errors:** Fix them before proceeding.

---

## 🔨 Step 2: Run Maven Build

Choose based on your situation:

### Scenario A: First Time Build (Full)

```bash
mvn clean install
```

This runs:
1. ✓ Clean (remove old artifacts)
2. ✓ Initialize (install Node.js, npm, pnpm)
3. ✓ Compile (TypeScript type checking)
4. ✓ Test (run all tests)
5. ✓ Verify (coverage reports)
6. ✓ Package (build all packages)
7. ✓ Install (success!)

**Output:**
```
[INFO] -------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] -------------------------------------------------------
[INFO] Total time: 8:45 min
[INFO] -------------------------------------------------------
```

### Scenario B: Rebuild (Tests Already Ran)

```bash
mvn clean install -DskipTests
```

Skips the long test phase. Use when:
- You just updated code
- You already ran tests locally
- You want to build faster

**Time:** ~1-2 minutes

### Scenario C: Production Build (Optimized)

```bash
mvn clean install -Pprod
```

Optimized for deployment:
- Full testing with coverage
- Production optimizations
- Packages web to `dist/`

**Time:** 5-10 minutes

### Scenario D: Development Build (With Servers)

```bash
mvn clean install -Pdev
```

After build, starts dev servers automatically:
- API on http://localhost:3000
- Web on http://localhost:5173

**Time:** 5-10 minutes (+ servers keep running)

---

## 🎯 Step 3: Monitor Build Progress

Watch what Maven is doing:

```
[INFO] Scanning for projects...
[INFO] 
[INFO] ------ Rent and Build - Parent Project ------
[INFO] 
[INFO] --- maven-clean-plugin:3.2.0:clean ---
[INFO] Deleting node_modules
[INFO] Deleting dist
[INFO] 
[INFO] --- frontend-maven-plugin:1.15.0:install-node-and-npm ---
[INFO] Installing node version v24.0.0 to /workspace/node
[INFO] npm version v10.8.3 to /workspace/npm
[INFO] 
[INFO] --- frontend-maven-plugin:1.15.0:npm ---
[INFO] Installing pnpm globally...
[INFO] 
[INFO] --- frontend-maven-plugin:1.15.0:npm ---
[INFO] Running: pnpm install
[INFO] Resolving workspace dependencies...
[INFO] Installing packages...
[INFO] 
[INFO] --- frontend-maven-plugin:1.15.0:npm ---
[INFO] Running: pnpm run typecheck
[INFO] TypeScript checking...
[INFO] ✓ No type errors
[INFO] 
[INFO] --- frontend-maven-plugin:1.15.0:npm ---
[INFO] Running: pnpm run test
[INFO] Running tests...
[INFO] ✓ 5/5 tests passed
[INFO] 
[INFO] --- frontend-maven-plugin:1.15.0:npm ---
[INFO] Running: pnpm run build
[INFO] Building packages...
[INFO] ✓ Build complete
[INFO] 
[INFO] BUILD SUCCESS
```

---

## 📊 Step 4: Verify Build Artifacts

After successful build, check that everything was created:

```bash
# Check if dist folder exists
ls -la dist/

# Check API server build
ls -la artifacts/api-server/dist/

# Check Web frontend build
ls -la artifacts/rentbuild-india/dist/

# Check coverage reports
ls -la coverage/

# Expected output should show files in each directory
```

---

## ▶️ Step 5: Run the Application

After build succeeds, start the servers:

### Terminal 1 - API Server:
```bash
pnpm run start:api
# Output: Server listening on port 3000
```

### Terminal 2 - Web Frontend:
```bash
pnpm run start:dev
# Output: VITE v7.x.x ready in 500ms
# ➜  Local:   http://localhost:5173/
# ➜  press h to show help
```

### Test It Works:
```bash
# Terminal 3 - Test API
curl http://localhost:3000/api/healthz
# Output: {"status":"ok"}

# Then open in browser: http://localhost:5173
```

---

## ❌ Troubleshooting

### Build Won't Start

**Problem:** `mvn: command not found`
```bash
# Solution: Add Maven to PATH
export PATH=$PATH:/path/to/maven/bin
# Or verify installation: which mvn
```

**Problem:** `java: command not found`
```bash
# Solution: Install Java or add to PATH
export PATH=$PATH:/path/to/jdk/bin
# Verify: java -version
```

### Build Fails During Install

**Problem:** `pnpm: command not found`
```
→ Normal during first build, Maven will install it
→ Just wait, it's downloading pnpm
```

**Problem:** `Cannot find module @workspace/...`
```bash
# Solution: Clear and reinstall
rm -rf node_modules pnpm-lock.yaml
mvn clean install
```

### Build Fails During Tests

**Problem:** Tests timeout
```
Solution 1: Skip tests on first build
mvn clean install -DskipTests

Solution 2: Run again without skipping
mvn clean install

Solution 3: Increase timeout in vitest config
# See artifacts/api-server/vitest.config.ts
```

**Problem:** Database connection error
```
Error: Error: connect ECONNREFUSED 127.0.0.1:5432

Solutions:
1. Start PostgreSQL (if using local)
2. Check DATABASE_URL in .env is correct
3. Verify database is running: psql -U rentbuild

Or skip tests:
mvn clean install -DskipTests
```

### Build Fails During Package Phase

**Problem:** `Cannot find module 'express'`
```bash
# Solution: Dependencies not installed
mvn clean install
# This will reinstall everything
```

**Problem:** TypeScript compilation errors
```bash
# Solution: Type errors in code
mvn clean install -X
# The -X flag shows detailed error messages
# Fix errors and try again
```

### Out of Memory

**Problem:** `Java heap space` or `OutOfMemoryError`
```bash
# Solution: Increase Java memory
export MAVEN_OPTS="-Xmx2g -Xms1g"
mvn clean install
```

### Port Already in Use

**Problem:** Port 3000 already in use
```bash
# Find what's using it
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=4000 pnpm run start:api
```

---

## 🎓 Understanding the Build

### What Each Phase Does

| Phase | What It Does | Time |
|-------|--------------|------|
| **clean** | Remove old build artifacts | <1s |
| **initialize** | Install Node.js, npm, pnpm | 30-60s |
| **install-deps** | Run `pnpm install` | 1-2 min |
| **typecheck** | TypeScript compilation check | 10-30s |
| **test** | Run all vitest tests | 30s-1min |
| **coverage** | Generate test reports | 20-30s |
| **build** | Build all packages | 1-2 min |
| **install** | Mark success | <1s |

**Total:** 5-10 minutes first time, 2-3 minutes subsequent

### Build Profiles

**Default Profile:**
```bash
mvn clean install
# Runs: clean → typecheck → test → build
```

**Production Profile:**
```bash
mvn clean install -Pprod
# Runs: clean → typecheck → test → coverage → build
# Everything optimized for production
```

**Development Profile:**
```bash
mvn clean install -Pdev
# Runs: clean → typecheck → test → build → start-servers
# Starts dev servers after build
```

---

## ✨ After Successful Build

### 1. Verify Installation
```bash
# Check that key files were created
test -d "dist" && echo "✓ dist/ created"
test -d "artifacts/api-server/dist" && echo "✓ api-server built"
test -d "artifacts/rentbuild-india/dist" && echo "✓ frontend built"
```

### 2. Run Tests Manually
```bash
# Run all tests
pnpm run test

# Watch mode (rerun on file change)
pnpm run test:watch

# With coverage
pnpm run test:coverage
```

### 3. Start Development
```bash
# Terminal 1
pnpm run start:api

# Terminal 2
pnpm run start:dev

# Open: http://localhost:5173
```

### 4. View Coverage Reports
```bash
# Coverage report locations
open artifacts/api-server/coverage/index.html
open artifacts/rentbuild-india/coverage/index.html
```

---

## 🔄 Common Workflows

### Daily Development
```bash
# One time
mvn clean install

# Then daily
pnpm run start:api &
pnpm run start:dev

# Edit code, it reloads automatically
```

### Before Committing
```bash
# Ensure everything builds
mvn clean install

# Run full tests
pnpm run test:coverage

# Check types
pnpm run typecheck
```

### CI/CD (GitHub Actions)
```bash
# In workflow
mvn clean install -Pprod
# Automatically tested and built
```

### Quick Rebuild
```bash
# Don't need tests
mvn clean install -DskipTests

# Just type check
pnpm run typecheck
```

---

## 📝 Summary

```
✅ Check prerequisites with: validate-build.bat
✅ Run full build with: mvn clean install
✅ Rebuild faster with: mvn clean install -DskipTests
✅ Start servers with: pnpm run start:api & pnpm run start:dev
✅ Run tests with: pnpm run test
✅ View coverage with: open artifacts/*/coverage/index.html
```

---

## 🎯 Build Success Checklist

After running `mvn clean install`:

- [ ] Build completed with "BUILD SUCCESS"
- [ ] All tests passed
- [ ] No compilation errors
- [ ] dist/ directory created
- [ ] artifacts/api-server/dist/ exists
- [ ] artifacts/rentbuild-india/dist/ exists
- [ ] coverage/ directory created
- [ ] API server starts: `pnpm run start:api`
- [ ] Frontend starts: `pnpm run start:dev`
- [ ] Browser opens to http://localhost:5173
- [ ] API responds: `curl http://localhost:3000/api/healthz`

✅ All checked? **You're ready to develop!**

---

## 🆘 Still Need Help?

1. **Read:** `BUILD-CHECKLIST.md` - Detailed troubleshooting
2. **Read:** `BUILD.md` - Comprehensive build documentation
3. **Check:** `.github/workflows/maven-build.yml` - CI/CD example
4. **Test:** Run validation script again: `validate-build.bat`

---

**Ready to build? Run:**

```bash
mvn clean install
```

**Expected: BUILD SUCCESS in 5-10 minutes** ✅


