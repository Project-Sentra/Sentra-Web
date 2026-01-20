-- Sentra Parking System - Supabase Schema
-- Run this SQL in your Supabase SQL Editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(120) UNIQUE NOT NULL,
    password VARCHAR(200) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parking spots table
CREATE TABLE IF NOT EXISTS parking_spots (
    id BIGSERIAL PRIMARY KEY,
    spot_name VARCHAR(10) UNIQUE NOT NULL,
    is_occupied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parking sessions table
CREATE TABLE IF NOT EXISTS parking_sessions (
    id BIGSERIAL PRIMARY KEY,
    plate_number VARCHAR(20) NOT NULL,
    spot_name VARCHAR(10) NOT NULL,
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    exit_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    amount_lkr INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cameras table
CREATE TABLE IF NOT EXISTS cameras (
    id BIGSERIAL PRIMARY KEY,
    camera_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    camera_type VARCHAR(20) NOT NULL,
    source_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detection logs table
CREATE TABLE IF NOT EXISTS detection_logs (
    id BIGSERIAL PRIMARY KEY,
    camera_id VARCHAR(50) NOT NULL,
    plate_number VARCHAR(20) NOT NULL,
    confidence FLOAT NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    action_taken VARCHAR(20),
    vehicle_class VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_parking_sessions_plate ON parking_sessions(plate_number);
CREATE INDEX IF NOT EXISTS idx_parking_sessions_exit_time ON parking_sessions(exit_time);
CREATE INDEX IF NOT EXISTS idx_detection_logs_detected_at ON detection_logs(detected_at);
CREATE INDEX IF NOT EXISTS idx_parking_spots_occupied ON parking_spots(is_occupied);

-- Enable Row Level Security (RLS) - Optional but recommended
-- For now, we'll allow all operations with anon key
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE detection_logs ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (for development)
CREATE POLICY "Allow all for users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for parking_spots" ON parking_spots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for parking_sessions" ON parking_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for cameras" ON cameras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for detection_logs" ON detection_logs FOR ALL USING (true) WITH CHECK (true);
