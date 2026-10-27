# Rent-and-Build

## Oracle Database setup

The API and equipment CSV importer use Oracle Database. For the local database settings in this project, the API connects to service `XEPDB1` at `localhost:1521` as user `PROJECT_DB`.

Create a local `.env.local` file (kept out of Git) and add your Oracle password:

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
notepad .env.local
```

Set `ORACLE_USER=PROJECT_DB`, `ORACLE_PASSWORD` to your password, and `ORACLE_CONNECT_STRING=localhost:1521/XEPDB1`. The Oracle driver uses these separate settings, so special characters such as `@` in the password do not need URL encoding. The API start script and Spring importer both load `.env.local`; you can also set these values as environment variables.

If Oracle is installed locally, make sure its database service and TNS listener are running. Verify the listener from PowerShell with `Test-NetConnection localhost -Port 1521`. In SQL Developer, connect using host `localhost`, port `1521`, service name `XEPDB1`, and username `PROJECT_DB`; open `lib/db/schema.sql` and run it as a script (F5) once to create the app and Spring Batch tables. Then install workspace dependencies and start the API:

```powershell
pnpm.cmd install
pnpm.cmd run start:api
```

The importer reads the same Oracle settings from `.env.local`. The schema script creates the Spring Batch metadata tables along with the application tables. Existing PostgreSQL/MySQL data is not migrated automatically; back up and migrate it separately before switching.

## Equipment CSV batch importer

The Maven project at the repository root provides a Spring Batch job that imports equipment listings into the existing Oracle `equipment` table. The database must already contain the Rent-and-Build schema, and every CSV `owner_id` must reference an existing user.

Use Java 17 and Maven to build the executable JAR:

```text
mvn clean install
```

The importer uses the Oracle credentials in `.env.local` by default. To override them for a hosted database, set `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD`, then run the importer with a CSV path:

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