package in.rentbuild.batch;

import java.math.BigDecimal;
import java.util.UUID;

public record EquipmentCsvRecord(
        UUID ownerId,
        String name,
        String category,
        String vehicleNumber,
        String licenseNumber,
        String rcCardNumber,
        String city,
        String description,
        BigDecimal hourlyRate,
        BigDecimal dailyRate,
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
