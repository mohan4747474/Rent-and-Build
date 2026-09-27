# Maven Build - Pre-Build Checklist & Step-by-Step Guide

## ✅ Pre-Build Checklist

Before running `mvn clean install`, verify the following:

### 1. System Requirements
- [ ] **Node.js v24+** - Check with: `node --version`
- [ ] **Java JDK 11+** - Check with: `java -version`
- [ ] **Maven 3.6+** - Check with: `mvn --version`
- [ ] **Git** - For version control

### 2. Project Setup
- [ ] **Repository cloned** - You have a local copy
- [ ] **No uncommitted changes** - Run `git status` to verify (optional)
- [ ] **Working directory clean** - Previous builds won't interfere

### 3. Environment Configuration
- [ ] **`.env` file exists** - Copy from `.env.example` if needed:
  ```bash
  cp .env.example .env
  ```
- [ ] **`DATABASE_URL` is set** - Must be a valid PostgreSQL connection:
  ```env
  DATABASE_URL=postgresql://rentbuild:rentbuild@localhost:5432/rentbuild
  ```
- [ ] **PostgreSQL is running** - Test connection:
  ```bash
  psql $DATABASE_URL -c "SELECT 1"
  ```
  Or use Docker:
  ```bash
  docker run -d --name rentbuild-pg \
    -e POSTGRES_USER=rentbuild \
    -e POSTGRES_PASSWORD=rentbuild \
    -e POSTGRES_DB=rentbuild \
    -p 5432:5432 \
    postgres:16-alpine
  ```

### 4. Dependencies
- [ ] **No stale `node_modules`** - Remove if upgrading:
  ```bash
  rm -rf node_modules
  ```
- [ ] **No stale Maven cache** - Only if experiencing issues:
  ```bash
  rm -rf ~/.m2/repository
  ```

## 🚀 Building Successfully

### Step 1: Validate Setup (Recommended)

**Windows:**
```bash
validate-build.bat
```

**Mac/Linux:**
```bash
bash validate-build.sh
```

This checks all prerequisites and ensures the build will succeed.

### Step 2: Run Maven Build

Choose one of these options based on your needs:

#### Option A: Full Build with Tests (Recommended)
```bash
mvn clean install
```

**What happens:**
1. ✓ Cleans previous build artifacts
2. ✓ Installs Node.js and pnpm
3. ✓ Installs all dependencies
4. ✓ Runs TypeScript type checking
5. ✓ Runs unit and integration tests
6. ✓ Generates coverage reports
7. ✓ Builds all packages
8. ✓ Success!

**Time:** 5-10 minutes (first run), 2-3 minutes (subsequent runs)

#### Option B: Build Without Tests (Faster)
```bash
mvn clean install -DskipTests
```

**Use when:**
- You just want to build quickly
- You've already run tests locally
- First-time setup is taking too long

**Time:** 2-3 minutes (first run), 1 minute (subsequent runs)

#### Option C: Production Build
```bash
mvn clean install -Pprod
```

**Features:**
- Full optimization
- Runs tests with coverage
- Packages web artifacts to `dist/`
- Ready for deployment

**Time:** 5-10 minutes

#### Option D: Development Build
```bash
mvn clean install -Pdev
```

**Features:**
- Standard build
- Starts development servers automatically
- Good for local iteration

## 📊 Expected Output

### Successful Build

The Maven build completes with:

```
[INFO] -------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] -------------------------------------------------------
[INFO] Total time: 5:23 min
[INFO] Finished at: 2026-09-25T10:30:00+00:00
[INFO] -------------------------------------------------------

✓ All tests passed
✓ Code coverage reports generated
✓ Packages built successfully
✓ Ready to run or deploy
```

### Where Are Artifacts?

After successful build:

| Location | Contains |
|----------|----------|
| `dist/` | Web frontend static files |
| `artifacts/api-server/dist/` | Bundled API server |
| `lib/*/dist/` | Built libraries |
| `coverage/` | Test coverage reports |

## ❌ Troubleshooting

### Build Fails Immediately

**Problem:** `mvn: command not found`
```bash
# Solution: Install or set PATH to Maven
export PATH=$PATH:/path/to/maven/bin
# Or use: mvn --version
```

**Problem:** `Could not find specified package`
```bash
# Solution: Clear and reinstall
rm -rf node_modules pnpm-lock.yaml
mvn clean install
```

### Tests Time Out

**Problem:** Tests take >30 seconds
```bash
# Solution: Increase timeout in vitest configs:
# artifacts/api-server/vitest.config.ts
# artifacts/rentbuild-india/vitest.config.ts
```

Change:
```typescript
testTimeout: 10000  // to 30000
```

### Database Connection Error

**Problem:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution 1: Docker (Easiest)**
```bash
docker run -d --name rentbuild-postgres \
  -e POSTGRES_USER=rentbuild \
  -e POSTGRES_PASSWORD=rentbuild \
  -e POSTGRES_DB=rentbuild \
  -p 5432:5432 \
  postgres:16-alpine
```

**Solution 2: Local PostgreSQL**
```bash
# Start PostgreSQL service
brew services start postgresql  # macOS
# or
sudo service postgresql start   # Linux

# Verify connection
psql -h localhost -U rentbuild -d rentbuild -c "SELECT 1"
```

**Solution 3: Skip Tests**
```bash
mvn clean install -DskipTests
```

### Port Conflicts

**Problem:** Port 3000 or 5173 already in use

**Solution:**
```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different ports
PORT=4000 pnpm run start:api
```

### Out of Memory

**Problem:** `OutOfMemoryError` during build

**Solution:**
```bash
# Increase Java heap size
export MAVEN_OPTS="-Xmx2g"
mvn clean install
```

### Corrupted Dependencies

**Problem:** Random build failures, corrupted JAR/package files

**Solution:**
```bash
# Full clean
rm -rf node_modules pnpm-lock.yaml
rm -rf ~/.m2/repository
rm -rf target

# Rebuild
mvn clean install
```

## 🔧 Build Customization

### Skip Specific Phases

```bash
# Skip typecheck
mvn clean install -Dmaven.compiler.skip=true

# Skip tests AND coverage
mvn clean install -DskipTests

# Skip both tests and coverage
mvn clean install -DskipTests -Dmaven.test.skip=true
```

### Parallel Build

```bash
# Use 4 threads for faster builds
mvn clean install -T 4

# Or auto-detect threads
mvn clean install -T 1C
```

### Offline Build

```bash
# After first successful install
mvn install -o
```

### Verbose Output (Debugging)

```bash
# See detailed build info
mvn clean install -X

# Show stack traces
mvn clean install -e
```

## 📝 Common Commands Reference

| Command | Purpose |
|---------|---------|
| `mvn clean` | Remove build artifacts |
| `mvn compile` | TypeScript compilation only |
| `mvn test` | Run tests only |
| `mvn package` | Build packages (no test) |
| `mvn verify` | Test + coverage reports |
| `mvn install` | Full install (final step) |
| `mvn clean install` | Complete fresh build |
| `mvn clean install -DskipTests` | Build without tests |
| `mvn clean install -Pprod` | Production optimized |
| `mvn clean install -Pdev` | Development + servers |

## ✨ After Successful Build

Once the build completes successfully:

### 1. Verify Installation
```bash
# Check that packages built
ls -la dist/
ls -la artifacts/api-server/dist/
ls -la artifacts/rentbuild-india/dist/

# Check test coverage
ls -la coverage/
```

### 2. Run Locally
```bash
# Terminal 1: API Server
pnpm run start:api

# Terminal 2: Web Frontend  
pnpm run start:dev

# Open browser: http://localhost:5173
```

### 3. Run Tests Manually
```bash
# All tests
pnpm run test

# Watch mode
pnpm run test:watch

# Coverage
pnpm run test:coverage
```

## 🎯 Build Summary

```
Maven Build Process
├── Initialize
│   ├── Install Node.js v24
│   ├── Install pnpm
│   └── Install pnpm globally
├── Compile
│   └── TypeScript type checking (tsc)
├── Test
│   ├── Unit tests (vitest --run)
│   └── Integration tests (supertest)
├── Verify
│   ├── Coverage reports (v8)
│   └── Artifacts validation
├── Package
│   ├── Build API server (esbuild)
│   ├── Build Frontend (vite)
│   └── Generate optimized bundles
└── Install
    └── SUCCESS! Ready to deploy
```

## 🆘 Still Having Issues?

1. **Run validation script first:**
   - Windows: `validate-build.bat`
   - Mac/Linux: `bash validate-build.sh`

2. **Check logs:**
   ```bash
   # Maven detailed output
   mvn clean install -X

   # NPM registry issues
   npm config set registry https://registry.npmjs.org/
   ```

3. **Reset everything:**
   ```bash
   rm -rf node_modules pnpm-lock.yaml ~/.m2/repository
   rm -rf dist artifacts/*/dist lib/*/dist
   rm -rf coverage target
   mvn clean install
   ```

4. **Try direct pnpm:**
   ```bash
   pnpm install
   pnpm run build
   pnpm run test
   ```

## 📞 Getting Help

- Check `BUILD.md` for detailed documentation
- See `QUICKSTART.md` for setup guide
- Review individual package `README.md` files
- Check `.github/workflows/maven-build.yml` for CI/CD example

---

**You're ready to build! Start with:**

```bash
validate-build.bat  # Windows: Check prerequisites
mvn clean install   # Run the build
```

**Expected time:** First run 5-10 minutes, subsequent runs 2-3 minutes


