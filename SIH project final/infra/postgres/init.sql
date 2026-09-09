-- Enable PostGIS extension for spatial queries and geography types
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: instruments (Argo floats, gliders, CTDs, BGC moorings)
CREATE TABLE IF NOT EXISTS instruments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(100) NOT NULL UNIQUE,
    platform_type VARCHAR(50) NOT NULL, -- 'argo', 'glider', 'ctd', 'bgc'
    location geography(Point, 4326) NOT NULL,
    last_report TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geospatial index on location for bounding box queries
CREATE INDEX IF NOT EXISTS idx_instruments_location ON instruments USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_instruments_type_report ON instruments (platform_type, last_report DESC);

-- Table: profiles (individual casts / profile cycles for an instrument)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    cycle_number INT,
    timestamp TIMESTAMPTZ NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    max_depth DOUBLE PRECISION,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_instrument_time ON profiles (instrument_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_coords ON profiles (latitude, longitude);

-- Table: measurements (depth-resolved observations in a profile)
CREATE TABLE IF NOT EXISTS measurements (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    depth DOUBLE PRECISION NOT NULL,
    pressure DOUBLE PRECISION,
    temperature DOUBLE PRECISION,
    salinity DOUBLE PRECISION,
    chlorophyll DOUBLE PRECISION,
    oxygen DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_measurements_profile_depth ON measurements (profile_id, depth ASC);
