# Rent-and-Build

## Equipment CSV batch importer

The Maven project at the repository root provides a Spring Batch job that imports equipment listings into the existing PostgreSQL `equipment` table. The database must already contain the Rent-and-Build schema, and every CSV `owner_id` must reference an existing user.

Use Java 17 and Maven to build the executable JAR:

```text
mvn clean install
```

Configure the database with `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD`, then run the importer with a CSV path:

```text
java -jar target/equipment-importer-1.0.0.jar inputFile=batch-input/equipment.csv
```

The CSV must contain the columns shown in `batch-input/equipment.csv`, in the same order. The first row is treated as the header. Spring Batch tracks completed input parameters, and the database rejects vehicle numbers that already exist.

Run the JUnit integration tests and generate the JaCoCo coverage report with:

```text
mvn clean verify
```

The tests exercise full job execution against an isolated in-memory database. The HTML coverage report is generated at `target/site/jacoco/index.html`.

rent and build


rentbuild@rb.com
admin information 