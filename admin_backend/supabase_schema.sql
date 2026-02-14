-- =============================================================================
-- Sentra LPR Parking System - Complete Database Schema (v2.0)
-- =============================================================================
-- Run this SQL in your Supabase SQL Editor to create all tables.
--
-- This schema supports:
--   - Admin web dashboard + Mobile app users (shared database)
--   - Vehicle registration linked to user accounts
--   - Multiple parking facilities with floors and spot types
--   - Advance spot reservations
--   - Automatic LPR-based entry/exit with gate control
--   - Wallet-based payments and subscriptions (monthly passes)
--   - Notifications for users
--   - Camera and gate hardware configuration
--   - Detection event logging
--
-- Tables (17):
--   users, vehicles, facilities, floors, parking_spots,
--   parking_sessions, reservations, pricing_plans, payment_methods, payments,
--   subscriptions, cameras, gates, detection_logs, gate_events,
--   notifications, user_wallets
-- =============================================================================


-- ────────────────────────────────────────────────────────────────
-- 1. USERS
-- ────────────────────────────────────────────────────────────────
-- Both admin (web dashboard) and regular users (mobile app).
-- Linked to Supabase Auth via auth_user_id.

CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    auth_user_id    UUID UNIQUE,                            -- FK to Supabase Auth (auth.users.id)
    email           VARCHAR(120) UNIQUE NOT NULL,
    full_name       VARCHAR(100),
    phone           VARCHAR(20),
    role            VARCHAR(20) DEFAULT 'user'              -- 'admin' | 'user' | 'operator'
                        CHECK (role IN ('admin', 'user', 'operator')),
    is_active       BOOLEAN DEFAULT TRUE,
    profile_image   TEXT,                                    -- URL to profile picture
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- 2. VEHICLES
-- ────────────────────────────────────────────────────────────────
-- Registered vehicles linked to user accounts.
-- When the LPR camera reads a plate, we look it up here.

CREATE TABLE IF NOT EXISTS vehicles (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plate_number    VARCHAR(20) UNIQUE NOT NULL,             -- e.g. "WP CA-1234"
    make            VARCHAR(50),                             -- e.g. "Toyota"
    model           VARCHAR(50),                             -- e.g. "Corolla"
    color           VARCHAR(30),                             -- e.g. "White"
    year            INTEGER,
    vehicle_type    VARCHAR(20) DEFAULT 'car'                -- 'car' | 'motorcycle' | 'truck' | 'van'
                        CHECK (vehicle_type IN ('car', 'motorcycle', 'truck', 'van')),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- 3. FACILITIES
-- ────────────────────────────────────────────────────────────────
-- Parking locations / buildings managed by the system.

CREATE TABLE IF NOT EXISTS facilities (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,                   -- e.g. "Sentra Main Parking"
    address         TEXT,
    city            VARCHAR(50),
    latitude        DECIMAL(10, 7),
    longitude       DECIMAL(10, 7),
    total_spots     INTEGER DEFAULT 0,
    hourly_rate     INTEGER DEFAULT 150,                     -- Base rate in LKR per hour
    currency        VARCHAR(3) DEFAULT 'LKR',
    operating_hours_start  TIME DEFAULT '06:00',
    operating_hours_end    TIME DEFAULT '22:00',
    is_active       BOOLEAN DEFAULT TRUE,
    image_url       TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- 4. FLOORS
-- ────────────────────────────────────────────────────────────────
-- Floors/levels within a facility.

CREATE TABLE IF NOT EXISTS floors (
    id              BIGSERIAL PRIMARY KEY,
    facility_id     BIGINT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    floor_number    INTEGER NOT NULL,                        -- 0 = ground, -1 = basement, 1 = first, etc.
    name            VARCHAR(50) NOT NULL,                    -- e.g. "Ground Floor", "Level B1"
    total_spots     INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(facility_id, floor_number)
);


-- ────────────────────────────────────────────────────────────────
-- 5. PARKING SPOTS
-- ────────────────────────────────────────────────────────────────
-- Individual parking bays with type, status, and floor location.

CREATE TABLE IF NOT EXISTS parking_spots (
    id              BIGSERIAL PRIMARY KEY,
    facility_id     BIGINT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    floor_id        BIGINT REFERENCES floors(id) ON DELETE SET NULL,
    spot_name       VARCHAR(10) NOT NULL,                    -- e.g. "A-01"
    spot_type       VARCHAR(20) DEFAULT 'regular'            -- 'regular' | 'handicapped' | 'ev_charging' | 'vip'
                        CHECK (spot_type IN ('regular', 'handicapped', 'ev_charging', 'vip')),
    is_occupied     BOOLEAN DEFAULT FALSE,
    is_reserved     BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,                    -- False = under maintenance
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(facility_id, spot_name)
);


-- ────────────────────────────────────────────────────────────────
-- 6. PRICING PLANS
-- ────────────────────────────────────────────────────────────────
-- Multiple pricing tiers per facility.

CREATE TABLE IF NOT EXISTS pricing_plans (
    id              BIGSERIAL PRIMARY KEY,
    facility_id     BIGINT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    name            VARCHAR(50) NOT NULL,                    -- e.g. "Hourly Standard", "Monthly Pass"
    plan_type       VARCHAR(20) NOT NULL                     -- 'hourly' | 'daily' | 'monthly' | 'reservation'
                        CHECK (plan_type IN ('hourly', 'daily', 'monthly', 'reservation')),
    rate            INTEGER NOT NULL,                        -- Amount in LKR
    description     TEXT,
    spot_type       VARCHAR(20) DEFAULT 'regular',           -- Which spot types this applies to
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- 7. RESERVATIONS
-- ────────────────────────────────────────────────────────────────
-- Advance spot bookings by mobile app users.

CREATE TABLE IF NOT EXISTS reservations (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id          BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    facility_id         BIGINT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    spot_id             BIGINT REFERENCES parking_spots(id) ON DELETE SET NULL,
    reserved_start      TIMESTAMP WITH TIME ZONE NOT NULL,
    reserved_end        TIMESTAMP WITH TIME ZONE NOT NULL,
    status              VARCHAR(20) DEFAULT 'pending'        -- 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'
                            CHECK (status IN ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
    amount              INTEGER,                             -- Reservation fee in LKR
    payment_status      VARCHAR(20) DEFAULT 'pending'        -- 'pending' | 'paid' | 'refunded'
                            CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    qr_code             TEXT,                                -- QR code data for check-in
    notes               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- 8. PARKING SESSIONS
-- ────────────────────────────────────────────────────────────────
-- Active and completed parking sessions (entry → exit).

CREATE TABLE IF NOT EXISTS parking_sessions (
    id              BIGSERIAL PRIMARY KEY,
    vehicle_id      BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,   -- NULL for unregistered vehicles
    facility_id     BIGINT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    spot_id         BIGINT REFERENCES parking_spots(id) ON DELETE SET NULL,
    reservation_id  BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
    plate_number    VARCHAR(20) NOT NULL,
    spot_name       VARCHAR(10) NOT NULL,
    entry_time      TIMESTAMP WITH TIME ZONE NOT NULL,
    exit_time       TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    amount          INTEGER,                                  -- Fee in LKR
    payment_status  VARCHAR(20) DEFAULT 'pending'             -- 'pending' | 'paid' | 'waived'
                        CHECK (payment_status IN ('pending', 'paid', 'waived')),
    session_type    VARCHAR(20) DEFAULT 'walk_in'             -- 'walk_in' | 'reserved' | 'subscription'
                        CHECK (session_type IN ('walk_in', 'reserved', 'subscription')),
    entry_method    VARCHAR(20) DEFAULT 'lpr'                 -- 'lpr' | 'manual' | 'qr_code'
                        CHECK (entry_method IN ('lpr', 'manual', 'qr_code')),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- 9. USER WALLETS
-- ────────────────────────────────────────────────────────────────
-- Prepaid balance for parking payments.

CREATE TABLE IF NOT EXISTS user_wallets (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance         INTEGER DEFAULT 0,                        -- Balance in LKR (stored as integer, no decimals)
    currency        VARCHAR(3) DEFAULT 'LKR',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- 9.5 PAYMENT METHODS (Stripe-ready)
-- ────────────────────────────────────────────────────────────────
-- Stored card metadata and provider references. No raw card data.

CREATE TABLE IF NOT EXISTS payment_methods (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                VARCHAR(20) DEFAULT 'card'            -- 'card' | 'bank_transfer' | 'mobile_money'
                            CHECK (type IN ('card', 'bank_transfer', 'mobile_money')),
    provider            VARCHAR(20) DEFAULT 'stripe',
    provider_method_id  VARCHAR(100),                         -- Stripe payment_method id
    card_brand          VARCHAR(50),
    last_four_digits    VARCHAR(4) NOT NULL,
    card_holder_name    VARCHAR(100),
    expiry_month        INTEGER,
    expiry_year         INTEGER,
    is_default          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- 10. PAYMENTS
-- ────────────────────────────────────────────────────────────────
-- All payment transactions.

CREATE TABLE IF NOT EXISTS payments (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT REFERENCES users(id) ON DELETE SET NULL,
    session_id          BIGINT REFERENCES parking_sessions(id) ON DELETE SET NULL,
    reservation_id      BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
    payment_method_id   BIGINT REFERENCES payment_methods(id) ON DELETE SET NULL,
    subscription_id     BIGINT,                               -- FK added after subscriptions table
    amount              INTEGER NOT NULL,                     -- Amount in LKR
    currency            VARCHAR(3) DEFAULT 'LKR',
    payment_method      VARCHAR(20) DEFAULT 'wallet'          -- 'wallet' | 'card' | 'cash' | 'bank_transfer'
                            CHECK (payment_method IN ('wallet', 'card', 'cash', 'bank_transfer')),
    payment_status      VARCHAR(20) DEFAULT 'completed'       -- 'pending' | 'completed' | 'failed' | 'refunded'
                            CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    transaction_ref     VARCHAR(100),                          -- External payment reference
    description         TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- 11. SUBSCRIPTIONS (Monthly Passes)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    facility_id     BIGINT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    vehicle_id      BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    plan_id         BIGINT NOT NULL REFERENCES pricing_plans(id) ON DELETE CASCADE,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    status          VARCHAR(20) DEFAULT 'active'              -- 'active' | 'expired' | 'cancelled'
                        CHECK (status IN ('active', 'expired', 'cancelled')),
    auto_renew      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add FK from payments to subscriptions now that table exists
ALTER TABLE payments ADD CONSTRAINT fk_payments_subscription
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;


-- ────────────────────────────────────────────────────────────────
-- 12. CAMERAS
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cameras (
    id              BIGSERIAL PRIMARY KEY,
    facility_id     BIGINT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    camera_id       VARCHAR(50) UNIQUE NOT NULL,              -- Internal reference ID
    name            VARCHAR(100) NOT NULL,
    camera_type     VARCHAR(20) NOT NULL                      -- 'entry' | 'exit' | 'monitoring'
                        CHECK (camera_type IN ('entry', 'exit', 'monitoring')),
    source_url      VARCHAR(255),                             -- RTSP/HTTP stream URL
    gate_id         BIGINT,                                   -- FK added after gates table
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- 13. GATES
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gates (
    id              BIGSERIAL PRIMARY KEY,
    facility_id     BIGINT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,                    -- e.g. "Main Entry Gate"
    gate_type       VARCHAR(20) NOT NULL                      -- 'entry' | 'exit' | 'bidirectional'
                        CHECK (gate_type IN ('entry', 'exit', 'bidirectional')),
    status          VARCHAR(20) DEFAULT 'closed'              -- 'open' | 'closed' | 'error'
                        CHECK (status IN ('open', 'closed', 'error')),
    camera_id       BIGINT REFERENCES cameras(id) ON DELETE SET NULL,
    hardware_ip     VARCHAR(50),                              -- IP address of gate controller
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add FK from cameras to gates now that table exists
ALTER TABLE cameras ADD CONSTRAINT fk_cameras_gate
    FOREIGN KEY (gate_id) REFERENCES gates(id) ON DELETE SET NULL;


-- ────────────────────────────────────────────────────────────────
-- 14. DETECTION LOGS
-- ────────────────────────────────────────────────────────────────
-- Every plate detection event from the LPR cameras.

CREATE TABLE IF NOT EXISTS detection_logs (
    id              BIGSERIAL PRIMARY KEY,
    camera_id       VARCHAR(50) NOT NULL,
    facility_id     BIGINT REFERENCES facilities(id) ON DELETE SET NULL,
    plate_number    VARCHAR(20) NOT NULL,
    confidence      FLOAT NOT NULL,
    vehicle_id      BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,   -- Non-null if plate is registered
    is_registered   BOOLEAN DEFAULT FALSE,                    -- Quick flag: is this a known vehicle?
    detected_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    action_taken    VARCHAR(20) DEFAULT 'pending'             -- 'pending' | 'entry' | 'exit' | 'ignored' | 'gate_opened'
                        CHECK (action_taken IN ('pending', 'entry', 'exit', 'ignored', 'gate_opened')),
    vehicle_class   VARCHAR(20),                              -- AI classification: 'car', 'truck', etc.
    image_url       TEXT,                                     -- Snapshot of the detection
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- 15. GATE EVENTS
-- ────────────────────────────────────────────────────────────────
-- Audit log: every gate open/close action.

CREATE TABLE IF NOT EXISTS gate_events (
    id              BIGSERIAL PRIMARY KEY,
    gate_id         BIGINT NOT NULL REFERENCES gates(id) ON DELETE CASCADE,
    event_type      VARCHAR(20) NOT NULL                      -- 'open' | 'close'
                        CHECK (event_type IN ('open', 'close')),
    triggered_by    VARCHAR(20) NOT NULL                      -- 'auto_lpr' | 'manual' | 'reservation' | 'subscription'
                        CHECK (triggered_by IN ('auto_lpr', 'manual', 'reservation', 'subscription')),
    vehicle_id      BIGINT REFERENCES vehicles(id) ON DELETE SET NULL,
    plate_number    VARCHAR(20),
    operator_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,  -- Who opened it manually
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────────
-- 16. NOTIFICATIONS
-- ────────────────────────────────────────────────────────────────
-- Push/in-app notifications for mobile app users.

CREATE TABLE IF NOT EXISTS notifications (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    message         TEXT NOT NULL,
    type            VARCHAR(30) DEFAULT 'system'              -- 'entry' | 'exit' | 'reservation' | 'payment' | 'subscription' | 'system'
                        CHECK (type IN ('entry', 'exit', 'reservation', 'payment', 'subscription', 'system')),
    is_read         BOOLEAN DEFAULT FALSE,
    data            JSONB,                                    -- Extra structured data (session_id, amount, etc.)
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- =============================================================================
-- INDEXES
-- =============================================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);

-- Parking spots
CREATE INDEX IF NOT EXISTS idx_spots_facility ON parking_spots(facility_id);
CREATE INDEX IF NOT EXISTS idx_spots_occupied ON parking_spots(is_occupied);
CREATE INDEX IF NOT EXISTS idx_spots_reserved ON parking_spots(is_reserved);

-- Parking sessions
CREATE INDEX IF NOT EXISTS idx_sessions_plate ON parking_sessions(plate_number);
CREATE INDEX IF NOT EXISTS idx_sessions_vehicle ON parking_sessions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_sessions_facility ON parking_sessions(facility_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exit ON parking_sessions(exit_time);
CREATE INDEX IF NOT EXISTS idx_sessions_entry ON parking_sessions(entry_time);

-- Reservations
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_facility ON reservations(facility_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_start ON reservations(reserved_start);

-- Payment methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default
    ON payment_methods(user_id, is_default);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method_id);

-- Detection logs
CREATE INDEX IF NOT EXISTS idx_detections_detected ON detection_logs(detected_at);
CREATE INDEX IF NOT EXISTS idx_detections_plate ON detection_logs(plate_number);
CREATE INDEX IF NOT EXISTS idx_detections_camera ON detection_logs(camera_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_vehicle ON subscriptions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Gate events
CREATE INDEX IF NOT EXISTS idx_gate_events_gate ON gate_events(gate_id);
CREATE INDEX IF NOT EXISTS idx_gate_events_time ON gate_events(created_at);


-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- Enable RLS on all tables. Development policies allow all operations.
-- For production, replace these with restrictive policies.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE detection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Development-only: allow all operations (replace for production!)
CREATE POLICY "dev_all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON facilities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON floors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON parking_spots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON pricing_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON reservations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON parking_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON user_wallets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON cameras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON gates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON detection_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON gate_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON notifications FOR ALL USING (true) WITH CHECK (true);


-- =============================================================================
-- SEED DATA (Optional)
-- =============================================================================
-- Uncomment and run these to create a default facility with spots.

-- INSERT INTO facilities (name, address, city, total_spots, hourly_rate)
-- VALUES ('Sentra Main Parking', '123 Colombo Road', 'Colombo', 32, 150);

-- INSERT INTO floors (facility_id, floor_number, name, total_spots)
-- VALUES (1, 0, 'Ground Floor', 32);

-- INSERT INTO pricing_plans (facility_id, name, plan_type, rate, description)
-- VALUES
--   (1, 'Hourly Standard', 'hourly', 150, 'LKR 150 per hour, billed per started hour'),
--   (1, 'Daily Rate', 'daily', 1000, 'LKR 1000 flat rate for up to 24 hours'),
--   (1, 'Monthly Pass', 'monthly', 15000, 'LKR 15,000 per month, unlimited parking'),
--   (1, 'Reservation Fee', 'reservation', 200, 'LKR 200 advance booking fee');
