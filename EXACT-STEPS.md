# 🎯 FOLLOW THESE EXACT STEPS FOR SUCCESSFUL BUILD

This file contains the exact commands to run in order for a guaranteed successful build.

---

## ⚡ Quick Path to Success (Total Time: ~15 minutes)

### STEP 1: Verify Prerequisites (~ 1 minute)

**Windows:**
```bash
validate-build.bat
```

**Mac/Linux:**
```bash
bash validate-build.sh
```

**Expected Output:**
```
✓ Node.js v24.x.x found
✓ Maven found
✓ Java found
✓ No critical errors found
You are ready to build!
```

**If there are errors:** Fix them before proceeding!

---

### STEP 2: Start Database (~ 1 minute)

**OPTION A: Using Docker (Recommended)**

```bash
docker run -d --name rentbuild-postgres \
  -e POSTGRES_USER=rentbuild \
  -e POSTGRES_PASSWORD=rentbuild \
  -e POSTGRES_DB=rentbuild \
  -p 5432:5432 \
  postgres:16-alpine
```

**Wait for it to start:**
```bash
docker logs rentbuild-postgres | grep "database system is ready"
```

**OPTION B: Using Local PostgreSQL (if already installed)**

```bash
# macOS
brew services start postgresql

# Linux
sudo service postgresql start

# Windows
# Open Services → Find PostgreSQL → Start it
```

**Verify it's running:**
```bash
psql -U rentbuild -d rentbuild -c "SELECT 1;"
```

---

### STEP 3: Build with Maven (~ 5-10 minutes)

```bash
mvn clean install
```

**This will:**
1. Install Node.js v24 (if not present)
2. Install npm and pnpm
3. Install all dependencies
4. Run TypeScript type checking
5. Run all tests
6. Generate coverage reports
7. Build all packages

**Expected Output:**
```
[INFO] Scanning for projects...
[INFO] Building Rent and Build - Parent Project
[INFO] 
[INFO] --- maven-clean-plugin:3.2.0:clean ---
[INFO] Deleting node_modules
[INFO] 
[INFO] --- frontend-maven-plugin:1.15.0:install-node-and-npm ---
[INFO] Installing node version v24.0.0
[INFO] Installing npm version 10.8.3
[INFO] 
[INFO] --- frontend-maven-plugin:1.15.0:npm ---
[INFO] Running: pnpm install
[INFO] 
[INFO] --- frontend-maven-plugin:1.15.0:npm ---
[INFO] Running: pnpm run typecheck
[INFO] 
[INFO] --- frontend-maven-plugin:1.15.0:npm ---
[INFO] Running: pnpm run test
[INFO] 
[INFO] --- frontend-maven-plugin:1.15.0:npm ---
[INFO] Running: pnpm run test:coverage
[INFO] 
[INFO] --- frontend-maven-plugin:1.15.0:npm ---
[INFO] Running: pnpm run build
[INFO] 
[INFO] -------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] -------------------------------------------------------
[INFO] Total time: 8:45 min
[INFO] Finished at: 2026-09-25T10:30:00Z
[INFO] -------------------------------------------------------
```

**Wait for `BUILD SUCCESS`** ✅

---

### STEP 4: Start Development Servers (~ 30 seconds)

**Terminal 1 - API Server:**
```bash
pnpm run start:api
```

**Expected Output:**
```
{ port: 3000 } Server listening
```

**Keep this running!**

**Terminal 2 - Web Frontend:**
```bash
pnpm run start:dev
```

**Expected Output:**
```
VITE v7.x.x  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

---

### STEP 5: Verify It Works (~ 1 minute)

**Terminal 3 - Test API:**
```bash
curl http://localhost:3000/api/healthz
```

**Expected Output:**
```json
{"status":"ok"}
```

**Open Browser:**
```
http://localhost:5173
```

**You should see the Rent and Build application loaded!** 🎉

---

## 🔧 If Build Fails

### If Validation Script Fails:

1. **Missing Node.js:**
   ```bash
   # Download and install from https://nodejs.org/
   node --version  # Verify it's v24+
   ```

2. **Missing Java:**
   ```bash
   # Download and install JDK from https://www.oracle.com/java/
   java -version   # Verify it's 11+
   ```

3. **Missing Maven:**
   ```bash
   # Download from https://maven.apache.org/
   # Add to PATH
   mvn --version   # Verify it's 3.6+
   ```

4. **Missing PostgreSQL:**
   ```bash
   # Use Docker (recommended)
   docker run -d --name rentbuild-postgres \
     -e POSTGRES_USER=rentbuild \
     -e POSTGRES_PASSWORD=rentbuild \
     -e POSTGRES_DB=rentbuild \
     -p 5432:5432 \
     postgres:16-alpine
   ```

---

### If Maven Build Fails:

**Check the error message in the output**

#### Database Connection Error:
```
Error: Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Stop and remove old container
docker stop rentbuild-postgres
docker rm rentbuild-postgres

# Start fresh
docker run -d --name rentbuild-postgres \
  -e POSTGRES_USER=rentbuild \
  -e POSTGRES_PASSWORD=rentbuild \
  -e POSTGRES_DB=rentbuild \
  -p 5432:5432 \
  postgres:16-alpine

# Wait for it to be ready
sleep 10

# Try build again
mvn clean install
```

#### Tests Timeout:
```
Vitest: test timeout
```

**Solution:**
```bash
# Skip tests and build faster
mvn clean install -DskipTests

# Then run tests separately
pnpm run test
```

#### Out of Memory:
```
OutOfMemoryError
```

**Solution:**
```bash
# Increase Java memory
export MAVEN_OPTS="-Xmx2g"
mvn clean install
```

#### Stale Dependencies:
```
Cannot find module
```

**Solution:**
```bash
# Clear and rebuild
rm -rf node_modules pnpm-lock.yaml
mvn clean install
```

---

## 📊 Alternative Build Options

### Quick Rebuild (Skip Tests)

If you just want to rebuild faster:

```bash
mvn clean install -DskipTests
```

**Time:** 1-2 minutes

---

### Production Build

For optimized production build:

```bash
mvn clean install -Pprod
```

**Time:** 5-10 minutes

---

### Using Make (Convenience)

If you have `make` installed:

```bash
make maven-build
```

---

### Direct pnpm (Without Maven)

If you prefer not to use Maven:

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run start:api &
pnpm run start:dev
```

---

## 🧪 Run Tests After Build

### All Tests Once:
```bash
pnpm run test
```

### Tests in Watch Mode (Auto-rerun):
```bash
pnpm run test:watch
```

### With Coverage:
```bash
pnpm run test:coverage
```

### Specific Package:
```bash
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/rentbuild-india run test
```

---

## 📊 Verify Build Artifacts

After successful build, check these directories exist:

```bash
# Web frontend
ls -la dist/

# API server
ls -la artifacts/api-server/dist/

# Frontend
ls -la artifacts/rentbuild-india/dist/

# Test coverage
ls -la coverage/
```

**All should have files!**

---

## 🎯 Complete Checklist

Mark off as you go:

```
Pre-Build
- [ ] Node.js v24+ installed
- [ ] Java JDK 11+ installed
- [ ] Maven 3.6+ installed
- [ ] PostgreSQL running (or Docker ready)
- [ ] .env file exists (copy from .env.example)
- [ ] DATABASE_URL set in .env

Validation
- [ ] Ran validate-build.bat or bash validate-build.sh
- [ ] Validation script passed

Database
- [ ] Docker PostgreSQL started OR
- [ ] Local PostgreSQL started

Build
- [ ] Ran: mvn clean install
- [ ] Build completed with SUCCESS
- [ ] All tests passed
- [ ] Coverage reports generated
- [ ] Artifacts created in dist/ directories

Servers
- [ ] Terminal 1: pnpm run start:api (running)
- [ ] Terminal 2: pnpm run start:dev (running)
- [ ] Terminal 3: curl http://localhost:3000/api/healthz → {"status":"ok"}
- [ ] Browser: http://localhost:5173 opens without errors

Success!
- [ ] All checks passed ✅
- [ ] Ready to develop! 🎉
```

---

## 🚨 Emergency Commands

If something goes really wrong:

```bash
# Stop all servers
pkill -f "node.*start"

# Stop Docker database
docker stop rentbuild-postgres
docker rm rentbuild-postgres

# Clean everything
rm -rf node_modules dist target
rm -rf artifacts/*/dist artifacts/*/node_modules
rm -rf lib/*/dist lib/*/node_modules
rm -rf coverage

# Start fresh
docker run -d --name rentbuild-postgres \
  -e POSTGRES_USER=rentbuild \
  -e POSTGRES_PASSWORD=rentbuild \
  -e POSTGRES_DB=rentbuild \
  -p 5432:5432 \
  postgres:16-alpine

# Wait for database
sleep 10

# Build again
mvn clean install
```

---

## 📞 Still Having Issues?

1. **Read `MAVEN-BUILD-GUIDE.md`** - Complete step-by-step guide
2. **Read `BUILD-CHECKLIST.md`** - Troubleshooting section
3. **Run validation script** - Check prerequisites
4. **Check Docker logs** - `docker logs rentbuild-postgres`
5. **Check Maven logs** - Look at console output for errors

---

## ✅ You Should See

### After `validate-build.bat`:
```
✓ No critical errors found
You are ready to build!
```

### After `mvn clean install`:
```
[INFO] BUILD SUCCESS
[INFO] Total time: 8:45 min
```

### After `pnpm run start:api`:
```
Server listening on port 3000
```

### After `pnpm run start:dev`:
```
VITE v7.x.x ready in 500 ms
Local:   http://localhost:5173/
```

### After `curl http://localhost:3000/api/healthz`:
```json
{"status":"ok"}
```

### After opening browser:
**You see the Rent and Build web interface loaded!** 🎉

---

## 🎓 Understanding the Process

```
Step 1: validate-build.bat → Checks prerequisites ✓
Step 2: Start PostgreSQL → Database ready ✓
Step 3: mvn clean install → Maven builds everything ✓
Step 4: pnpm run start:api → API server running ✓
Step 5: pnpm run start:dev → Frontend running ✓
Step 6: curl & browser → Verify it works ✓
Step 7: SUCCESS! 🎉 Ready to develop
```

---

## 🚀 You're Ready!

Follow the steps above in order, and you'll have a working build.

**Expected time: ~15 minutes total**

```bash
# Step 1
validate-build.bat

# Step 2
docker run -d --name rentbuild-postgres \
  -e POSTGRES_USER=rentbuild \
  -e POSTGRES_PASSWORD=rentbuild \
  -e POSTGRES_DB=rentbuild \
  -p 5432:5432 \
  postgres:16-alpine

# Step 3
mvn clean install

# Step 4 & 5 (in separate terminals)
pnpm run start:api    # Terminal 1
pnpm run start:dev    # Terminal 2

# Step 6 (in third terminal or browser)
curl http://localhost:3000/api/healthz
# Open: http://localhost:5173
```

**That's it!** 🎉


