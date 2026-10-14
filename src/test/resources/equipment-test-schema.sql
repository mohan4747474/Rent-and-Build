CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS equipment (
    id UUID DEFAULT RANDOM_UUID() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    vehicle_number VARCHAR(255) NOT NULL UNIQUE,
    license_number VARCHAR(255) NOT NULL,
    rc_card_number VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    hourly_rate DECIMAL(12, 2) NOT NULL,
    daily_rate DECIMAL(12, 2) NOT NULL,
    working_hours INTEGER NOT NULL DEFAULT 0,
    odometer_km INTEGER NOT NULL DEFAULT 0,
    km_driven INTEGER NOT NULL DEFAULT 0,
    owner_phone VARCHAR(255) NOT NULL,
    operator_name VARCHAR(255) NOT NULL,
    operator_phone VARCHAR(255) NOT NULL,
    operator_experience VARCHAR(255) NOT NULL,
    sensors_working BOOLEAN NOT NULL DEFAULT FALSE,
    ecu_device_id VARCHAR(255) UNIQUE,
    available BOOLEAN NOT NULL DEFAULT TRUE
);
