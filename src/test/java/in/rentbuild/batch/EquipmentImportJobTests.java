package in.rentbuild.batch;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.batch.core.BatchStatus;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobExecution;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.boot.SpringApplication;
import org.mockito.MockedStatic;
import org.mockito.Mockito;

@SpringBootTest(properties = {
        "spring.config.location=classpath:/application.properties",
        "spring.datasource.url=jdbc:h2:mem:equipment-import;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.batch.jdbc.initialize-schema=always",
        "spring.datasource.password=",
        "spring.batch.job.enabled=false"
})
@Sql("/equipment-test-schema.sql")
class EquipmentImportJobTests {
    private static final UUID OWNER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String HEADER = """
            owner_id,name,category,vehicle_number,license_number,rc_card_number,city,description,hourly_rate,daily_rate,working_hours,odometer_km,km_driven,owner_phone,operator_name,operator_phone,operator_experience,sensors_working,ecu_device_id,available
            """.strip();

    @Autowired
    private JobLauncher jobLauncher;

    @Autowired
    private Job importEquipmentJob;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @TempDir
    Path tempDir;

    @BeforeEach
    void prepareDatabase() {
        jdbcTemplate.update("DELETE FROM equipment");
        jdbcTemplate.update("DELETE FROM users");
        jdbcTemplate.update("INSERT INTO users (id) VALUES (?)", OWNER_ID);
    }

    @Test
    void applicationMainStartsTheSpringBootApplication() {
        String[] args = {"--spring.batch.job.enabled=false"};
        try (MockedStatic<SpringApplication> springApplication = Mockito.mockStatic(SpringApplication.class)) {
            EquipmentImporterApplication.main(args);

            springApplication.verify(() -> SpringApplication.run(EquipmentImporterApplication.class, args));
        }
    }

    @Test
    void normalizesOptionalDeviceIds() {
        assertThat(EquipmentImportConfiguration.blankToNull(null)).isNull();
        assertThat(EquipmentImportConfiguration.blankToNull("  ")).isNull();
        assertThat(EquipmentImportConfiguration.blankToNull(" device-3 ")).isEqualTo("device-3");
    }

    @Test
    void importsEquipmentAndPersistsAllCsvFields() throws Exception {
        String description = "Heavy-duty, \"compact\" excavator";
        JobExecution execution = executeImport(csv(
                row("KA01AB1234", quote(description), "rzp-device-1", "true", "true")));

        assertThat(execution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
        assertThat(execution.getStepExecutions()).singleElement()
                .satisfies(step -> {
                    assertThat(step.getReadCount()).isEqualTo(1);
                    assertThat(step.getWriteCount()).isEqualTo(1);
                });

        EquipmentRow imported = jdbcTemplate.queryForObject("""
                SELECT owner_id, name, category, vehicle_number, license_number,
                       rc_card_number, city, description, hourly_rate, daily_rate,
                       working_hours, odometer_km, km_driven, owner_phone,
                       operator_name, operator_phone, operator_experience,
                       sensors_working, ecu_device_id, available
                FROM equipment WHERE vehicle_number = ?
                """, (rs, rowNum) -> new EquipmentRow(
                rs.getObject("owner_id", UUID.class),
                rs.getString("name"),
                rs.getString("category"),
                rs.getString("vehicle_number"),
                rs.getString("license_number"),
                rs.getString("rc_card_number"),
                rs.getString("city"),
                rs.getString("description"),
                rs.getBigDecimal("hourly_rate").toPlainString(),
                rs.getBigDecimal("daily_rate").toPlainString(),
                rs.getInt("working_hours"),
                rs.getInt("odometer_km"),
                rs.getInt("km_driven"),
                rs.getString("owner_phone"),
                rs.getString("operator_name"),
                rs.getString("operator_phone"),
                rs.getString("operator_experience"),
                rs.getBoolean("sensors_working"),
                rs.getString("ecu_device_id"),
                rs.getBoolean("available")),
                "KA01AB1234");

        assertThat(imported).isEqualTo(new EquipmentRow(
                OWNER_ID, "Excavator", "Earthmoving", "KA01AB1234",
                "DL-EXAMPLE-001", "RC-EXAMPLE-001", "Bengaluru", description,
                "1500.00", "10000.00", 1200, 45000, 18000,
                "+919876543210", "Sample Operator", "+919876543211", "5 years",
                true, "rzp-device-1", true));
    }

    @Test
    void importsBlankOptionalDeviceIdAsNullAndParsesFalseFlags() throws Exception {
        JobExecution execution = executeImport(csv(
                row("KA01AB1235", "Listing without device", "", "false", "false")));

        assertThat(execution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT ecu_device_id FROM equipment WHERE vehicle_number = ?",
                String.class, "KA01AB1235")).isNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT sensors_working = false AND available = false FROM equipment WHERE vehicle_number = ?",
                Boolean.class, "KA01AB1235")).isTrue();
    }

    @Test
    void importsTheCheckedInSampleCsv() throws Exception {
        Path sampleCsv = Path.of("batch-input", "equipment.csv").toAbsolutePath();
        JobParameters parameters = new JobParametersBuilder()
                .addString("inputFile", sampleCsv.toString())
                .addString("testRun", UUID.randomUUID().toString())
                .toJobParameters();

        JobExecution execution = jobLauncher.run(importEquipmentJob, parameters);

        assertThat(execution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM equipment WHERE vehicle_number = ?",
                Integer.class, "KA01AB1234")).isEqualTo(1);
    }

    @Test
    void completesSuccessfullyForHeaderOnlyCsv() throws Exception {
        JobExecution execution = executeImport(csv());

        assertThat(execution.getStatus()).isEqualTo(BatchStatus.COMPLETED);
        assertThat(execution.getStepExecutions()).singleElement()
                .satisfies(step -> {
                    assertThat(step.getReadCount()).isZero();
                    assertThat(step.getWriteCount()).isZero();
                });
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM equipment", Integer.class))
                .isZero();
    }

    @Test
    void failsMalformedRecordsWithoutWritingEquipment() throws Exception {
        JobExecution execution = executeImport(csv(row(
                "KA01AB1236", "Invalid owner id row", "device-2", "true", "true")
                .replace(OWNER_ID.toString(), "not-a-uuid")));

        assertThat(execution.getStatus()).isEqualTo(BatchStatus.FAILED);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM equipment", Integer.class))
                .isZero();
    }

    @Test
    void failsWhenOwnerDoesNotExist() throws Exception {
        String unknownOwner = UUID.randomUUID().toString();
        JobExecution execution = executeImport(csv(row(
                "KA01AB1238", "Unknown owner listing", "", "true", "true")
                .replace(OWNER_ID.toString(), unknownOwner)));

        assertThat(execution.getStatus()).isEqualTo(BatchStatus.FAILED);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM equipment", Integer.class))
                .isZero();
    }

    @Test
    void failsInvalidRatesWithoutWritingEquipment() throws Exception {
        JobExecution execution = executeImport(csv(row(
                "KA01AB1239", "Invalid rate listing", "", "true", "true")
                .replace(",1500.00,", ",not-money,")));

        assertThat(execution.getStatus()).isEqualTo(BatchStatus.FAILED);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM equipment", Integer.class))
                .isZero();
    }

    @Test
    void rejectsVehicleNumbersThatDoNotStartWithLetters() throws Exception {
        JobExecution execution = executeImport(csv(row(
                "1KA01AB1234", "Invalid vehicle number", "", "true", "true")));

        assertThat(execution.getStatus()).isEqualTo(BatchStatus.FAILED);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM equipment", Integer.class))
                .isZero();
    }

    @Test
    void rejectsPhoneNumbersWithoutCountryCodes() throws Exception {
        JobExecution execution = executeImport(csv(row(
                "KA01AB1240", "Invalid owner phone", "", "true", "true")
                .replace("+919876543210", "9876543210")));

        assertThat(execution.getStatus()).isEqualTo(BatchStatus.FAILED);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM equipment", Integer.class))
                .isZero();
    }

    @Test
    void rejectsInvalidOperatorPhoneNumbers() throws Exception {
        JobExecution execution = executeImport(csv(row(
                "KA01AB1241", "Invalid operator phone", "", "true", "true")
                .replace("+919876543211", "9876543211")));

        assertThat(execution.getStatus()).isEqualTo(BatchStatus.FAILED);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM equipment", Integer.class))
                .isZero();
    }

    @Test
    void failsWhenInputFileDoesNotExist() throws Exception {
        Path missingInput = tempDir.resolve("missing-equipment.csv");
        JobParameters parameters = new JobParametersBuilder()
                .addString("inputFile", missingInput.toAbsolutePath().toString())
                .toJobParameters();

        JobExecution execution = jobLauncher.run(importEquipmentJob, parameters);

        assertThat(execution.getStatus()).isEqualTo(BatchStatus.FAILED);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM equipment", Integer.class))
                .isZero();
    }

    @Test
    void failsDuplicateVehicleNumbersAndRollsBackTheChunk() throws Exception {
        JobExecution execution = executeImport(csv(
                row("KA01AB1237", "First listing", "", "true", "true"),
                row("KA01AB1237", "Duplicate listing", "", "true", "true")));

        assertThat(execution.getStatus()).isEqualTo(BatchStatus.FAILED);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM equipment", Integer.class))
                .isZero();
    }

    private JobExecution executeImport(String content) throws Exception {
        Path input = tempDir.resolve(UUID.randomUUID() + ".csv");
        Files.writeString(input, content);
        JobParameters parameters = new JobParametersBuilder()
                .addString("inputFile", input.toAbsolutePath().toString())
                .toJobParameters();
        return jobLauncher.run(importEquipmentJob, parameters);
    }

    private static String csv(String... rows) {
        return HEADER + System.lineSeparator() + String.join(System.lineSeparator(), rows);
    }

    private static String row(
            String vehicleNumber,
            String description,
            String ecuDeviceId,
            String sensorsWorking,
            String available) {
        return String.join(",",
                OWNER_ID.toString(), "Excavator", "Earthmoving", vehicleNumber,
                "DL-EXAMPLE-001", "RC-EXAMPLE-001", "Bengaluru", description,
                "1500.00", "10000.00", "1200", "45000", "18000",
                "+919876543210", "Sample Operator", "+919876543211", "5 years",
                sensorsWorking, ecuDeviceId, available);
    }

    private static String quote(String value) {
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private record EquipmentRow(
            UUID ownerId,
            String name,
            String category,
            String vehicleNumber,
            String licenseNumber,
            String rcCardNumber,
            String city,
            String description,
            String hourlyRate,
            String dailyRate,
            int workingHours,
            int odometerKm,
            int kmDriven,
            String ownerPhone,
            String operatorName,
            String operatorPhone,
            String operatorExperience,
            boolean sensorsWorking,
            String ecuDeviceId,
            boolean available) {
    }
}
