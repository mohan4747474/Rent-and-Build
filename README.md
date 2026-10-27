# Rent-and-Build

## MySQL setup

The API and equipment CSV importer use **MySQL 8.4**. For a local database, install Docker Desktop, then start the included MySQL service from the repository root:

```powershell
docker compose up -d mysql
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

The included Compose file creates a local `rentbuild` database and user. Its development-only credentials match this connection string in `.env`:

```dotenv
DATABASE_URL=mysql://rentbuild:rentbuild_dev_password@127.0.0.1:3306/rentbuild
```

If you already have a `.env`, update its `DATABASE_URL` instead of copying the sample again. Once MySQL is healthy, create/update the application tables and start the API:

```powershell
pnpm.cmd install
pnpm.cmd --filter @workspace/db run push
pnpm.cmd run start:api
```

The API start script loads the root `.env` automatically. For a hosted MySQL provider, create a MySQL 8 database and a restricted application user, allow connections from the API server, and set `DATABASE_URL` to the provider's URI. Percent-encode special characters in the username or password (for example, `@` as `%40`). Keep provider credentials in environment variables or a secret manager; do not use the local Compose passwords in production.

The Spring Batch importer uses JDBC environment variables rather than `DATABASE_URL`. Its default URL, username, and development password match the local Compose service. For a hosted provider, set `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD` to the provider's JDBC connection details. After the API schema has been created, build and run the importer as described below.

**Existing PostgreSQL data is not converted automatically.** Back up and migrate your data to MySQL before switching an existing deployment; `drizzle-kit push` is for applying the MySQL schema, not for transferring PostgreSQL data.

## Equipment CSV batch importer

The Maven project at the repository root provides a Spring Batch job that imports equipment listings into the existing MySQL `equipment` table. The database must already contain the Rent-and-Build schema, and every CSV `owner_id` must reference an existing user.

Use Java 17 and Maven to build the executable JAR:

```text
mvn clean install
```

Configure the database with `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD`, then run the importer with a CSV path:

```text
java -jar target/equipment-importer-1.0.0.jar inputFile=batch-input/equipment.csv
```

The CSV must contain the columns shown in `batch-input/equipment.csv`, in the same order. The first row is treated as the header. Vehicle numbers must start with a letter, and owner/operator phone numbers must use international format with a leading `+` and country code (for example, `+919876543210`). Invalid rows fail the import before they are written. Spring Batch tracks completed input parameters, and the database rejects vehicle numbers that already exist.

Run the JUnit integration tests and generate the JaCoCo coverage report with:

```text
mvn clean verify
```

The tests exercise full job execution against an isolated in-memory database. The HTML coverage report is generated at `target/site/jacoco/index.html`.

rent and build


rentbuild@rb.com
admin information 