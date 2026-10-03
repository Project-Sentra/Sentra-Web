-- ================================================================
-- normalize_plates.sql — canonical plate numbers (run once, Supabase SQL editor)
-- ================================================================
-- LPR reads "CAG 5124", the app lets users type "CAG-5124", admins type
-- anything. Entry is an exact match on vehicles.plate_number, so they never
-- matched. Canonical form = uppercase letters/digits only: "CAG5124".
-- The backend normalizes too (routes_common.normalize_plate); this trigger
-- covers every other writer (mobile app writes straight to Supabase).
--
-- Safe to re-run.
-- ================================================================

-- 1) Collision check. If this returns rows, two vehicles collapse to the same
--    plate — deactivate/delete one of them first, or step 3 fails on UNIQUE.
SELECT upper(regexp_replace(plate_number, '[^A-Za-z0-9]', '', 'g')) AS plate,
       array_agg(id) AS vehicle_ids
FROM vehicles
GROUP BY 1
HAVING count(*) > 1;

BEGIN;

-- 2) Trigger: normalize on every insert/update
CREATE OR REPLACE FUNCTION normalize_plate_number() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.plate_number IS NOT NULL THEN
        NEW.plate_number := upper(regexp_replace(NEW.plate_number, '[^A-Za-z0-9]', '', 'g'));
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_normalize_plate ON vehicles;
CREATE TRIGGER trg_normalize_plate BEFORE INSERT OR UPDATE OF plate_number ON vehicles
    FOR EACH ROW EXECUTE FUNCTION normalize_plate_number();

DROP TRIGGER IF EXISTS trg_normalize_plate ON parking_sessions;
CREATE TRIGGER trg_normalize_plate BEFORE INSERT OR UPDATE OF plate_number ON parking_sessions
    FOR EACH ROW EXECUTE FUNCTION normalize_plate_number();

DROP TRIGGER IF EXISTS trg_normalize_plate ON detection_logs;
CREATE TRIGGER trg_normalize_plate BEFORE INSERT OR UPDATE OF plate_number ON detection_logs
    FOR EACH ROW EXECUTE FUNCTION normalize_plate_number();

DROP TRIGGER IF EXISTS trg_normalize_plate ON gate_events;
CREATE TRIGGER trg_normalize_plate BEFORE INSERT OR UPDATE OF plate_number ON gate_events
    FOR EACH ROW EXECUTE FUNCTION normalize_plate_number();

-- 3) Fix existing rows (the trigger rewrites the value)
UPDATE vehicles         SET plate_number = plate_number WHERE plate_number ~ '[^A-Z0-9]';
UPDATE parking_sessions SET plate_number = plate_number WHERE plate_number ~ '[^A-Z0-9]';
UPDATE detection_logs   SET plate_number = plate_number WHERE plate_number ~ '[^A-Z0-9]';
UPDATE gate_events      SET plate_number = plate_number WHERE plate_number ~ '[^A-Z0-9]';

COMMIT;
