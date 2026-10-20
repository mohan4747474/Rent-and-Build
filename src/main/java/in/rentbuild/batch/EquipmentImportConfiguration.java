package in.rentbuild.batch;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import javax.sql.DataSource;

import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.item.ItemProcessor;
import org.springframework.batch.item.ItemReader;
import org.springframework.batch.item.database.JdbcBatchItemWriter;
import org.springframework.batch.item.database.builder.JdbcBatchItemWriterBuilder;
import org.springframework.batch.item.file.FlatFileItemReader;
import org.springframework.batch.item.file.builder.FlatFileItemReaderBuilder;
import org.springframework.batch.item.file.mapping.DefaultLineMapper;
import org.springframework.batch.item.file.transform.DelimitedLineTokenizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class EquipmentImportConfiguration {
    private static final String VEHICLE_NUMBER_PATTERN = "^[A-Za-z][A-Za-z0-9 -]*$";
    private static final String INTERNATIONAL_PHONE_PATTERN = "^\\+[1-9][0-9]{7,14}$";
    private static final String[] CSV_COLUMNS = {
            "owner_id", "name", "category", "vehicle_number", "license_number",
            "rc_card_number", "city", "description", "hourly_rate", "daily_rate",
            "working_hours", "odometer_km", "km_driven", "owner_phone",
            "operator_name", "operator_phone", "operator_experience",
            "sensors_working", "ecu_device_id", "available"
    };

    @Bean
    @org.springframework.batch.core.configuration.annotation.StepScope
    public FlatFileItemReader<EquipmentCsvRecord> equipmentReader(
            @Value("#{jobParameters['inputFile']}") String inputFile) throws Exception {
        DelimitedLineTokenizer tokenizer = new DelimitedLineTokenizer();
        tokenizer.setNames(CSV_COLUMNS);
        tokenizer.setDelimiter(",");
        tokenizer.setQuoteCharacter('"');

        DefaultLineMapper<EquipmentCsvRecord> lineMapper = new DefaultLineMapper<>();
        lineMapper.setLineTokenizer(tokenizer);
        lineMapper.setFieldSetMapper(fields -> new EquipmentCsvRecord(
                UUID.fromString(fields.readString("owner_id").trim()),
                fields.readString("name"),
                fields.readString("category"),
                fields.readString("vehicle_number"),
                fields.readString("license_number"),
                fields.readString("rc_card_number"),
                fields.readString("city"),
                fields.readString("description"),
                new BigDecimal(fields.readString("hourly_rate").trim()),
                new BigDecimal(fields.readString("daily_rate").trim()),
                fields.readInt("working_hours"),
                fields.readInt("odometer_km"),
                fields.readInt("km_driven"),
                fields.readString("owner_phone"),
                fields.readString("operator_name"),
                fields.readString("operator_phone"),
                fields.readString("operator_experience"),
                fields.readBoolean("sensors_working"),
                blankToNull(fields.readString("ecu_device_id")),
                fields.readBoolean("available")));
        lineMapper.afterPropertiesSet();

        return new FlatFileItemReaderBuilder<EquipmentCsvRecord>()
                .name("equipmentCsvReader")
                .resource(new FileSystemResource(inputFile))
                .encoding(StandardCharsets.UTF_8.name())
                .linesToSkip(1)
                .lineMapper(lineMapper)
                .build();
    }

    @Bean
    public JdbcBatchItemWriter<EquipmentCsvRecord> equipmentWriter(DataSource dataSource) {
        return new JdbcBatchItemWriterBuilder<EquipmentCsvRecord>()
                .dataSource(dataSource)
                .sql("""
                        INSERT INTO equipment (
                            owner_id, name, category, vehicle_number, license_number,
                            rc_card_number, city, description, hourly_rate, daily_rate,
                            working_hours, odometer_km, km_driven, owner_phone,
                            operator_name, operator_phone, operator_experience,
                            sensors_working, ecu_device_id, available
                        ) VALUES (
                            :ownerId, :name, :category, :vehicleNumber, :licenseNumber,
                            :rcCardNumber, :city, :description, :hourlyRate, :dailyRate,
                            :workingHours, :odometerKm, :kmDriven, :ownerPhone,
                            :operatorName, :operatorPhone, :operatorExperience,
                            :sensorsWorking, :ecuDeviceId, :available
                        )
                        """)
                .itemSqlParameterSourceProvider(item -> new MapSqlParameterSource()
                        .addValue("ownerId", item.ownerId())
                        .addValue("name", item.name())
                        .addValue("category", item.category())
                        .addValue("vehicleNumber", item.vehicleNumber())
                        .addValue("licenseNumber", item.licenseNumber())
                        .addValue("rcCardNumber", item.rcCardNumber())
                        .addValue("city", item.city())
                        .addValue("description", item.description())
                        .addValue("hourlyRate", item.hourlyRate())
                        .addValue("dailyRate", item.dailyRate())
                        .addValue("workingHours", item.workingHours())
                        .addValue("odometerKm", item.odometerKm())
                        .addValue("kmDriven", item.kmDriven())
                        .addValue("ownerPhone", item.ownerPhone())
                        .addValue("operatorName", item.operatorName())
                        .addValue("operatorPhone", item.operatorPhone())
                        .addValue("operatorExperience", item.operatorExperience())
                        .addValue("sensorsWorking", item.sensorsWorking())
                        .addValue("ecuDeviceId", item.ecuDeviceId(), java.sql.Types.VARCHAR)
                        .addValue("available", item.available()))
                .build();
    }

    @Bean
    public ItemProcessor<EquipmentCsvRecord, EquipmentCsvRecord> validateEquipment() {
        return item -> {
            if (item.vehicleNumber() == null || !item.vehicleNumber().trim().matches(VEHICLE_NUMBER_PATTERN)) {
                throw new IllegalArgumentException("Vehicle number must start with a letter: " + item.vehicleNumber());
            }
            if (!isInternationalPhone(item.ownerPhone())) {
                throw new IllegalArgumentException("Owner phone must include + and a country code: " + item.ownerPhone());
            }
            if (!isInternationalPhone(item.operatorPhone())) {
                throw new IllegalArgumentException("Operator phone must include + and a country code: " + item.operatorPhone());
            }
            return item;
        };
    }

    private static boolean isInternationalPhone(String phone) {
        return phone != null && phone.matches(INTERNATIONAL_PHONE_PATTERN);
    }

    @Bean
    public Step importEquipmentStep(
            JobRepository jobRepository,
            PlatformTransactionManager transactionManager,
            ItemReader<EquipmentCsvRecord> equipmentReader,
            ItemProcessor<EquipmentCsvRecord, EquipmentCsvRecord> validateEquipment,
            JdbcBatchItemWriter<EquipmentCsvRecord> equipmentWriter) {
        return new StepBuilder("importEquipmentStep", jobRepository)
                .<EquipmentCsvRecord, EquipmentCsvRecord>chunk(100, transactionManager)
                .reader(equipmentReader)
                .processor(validateEquipment)
                .writer(equipmentWriter)
                .build();
    }

    @Bean
    public Job importEquipmentJob(JobRepository jobRepository, Step importEquipmentStep) {
        return new JobBuilder("importEquipmentJob", jobRepository)
                .start(importEquipmentStep)
                .build();
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
