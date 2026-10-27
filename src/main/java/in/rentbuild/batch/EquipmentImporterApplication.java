package in.rentbuild.batch;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class EquipmentImporterApplication {
    public static void main(String[] args) {
        loadLocalEnvironment();
        SpringApplication.run(EquipmentImporterApplication.class, args);
    }

    private static void loadLocalEnvironment() {
        Path envFile = Path.of(".env.local");
        if (!Files.isRegularFile(envFile)) {
            return;
        }
        try {
            for (String line : Files.readAllLines(envFile, StandardCharsets.UTF_8)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                int separator = trimmed.indexOf('=');
                if (separator <= 0) {
                    continue;
                }
                String name = trimmed.substring(0, separator).trim();
                String value = trimmed.substring(separator + 1).trim();
                if (System.getenv(name) == null && System.getProperty(name) == null) {
                    System.setProperty(name, value);
                }
            }
        } catch (IOException error) {
            throw new IllegalStateException("Could not load local database settings from .env.local", error);
        }
    }
}
