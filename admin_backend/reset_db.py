"""
reset_db.py - Database Reset & Seed Script (v2.0)
===================================================
Clears all transactional data from the Supabase database, then seeds
a default facility with spots, floors, and pricing plans.

Usage:
  cd admin_backend
  python reset_db.py              # Full reset + seed
  python reset_db.py --seed-only  # Skip deletion, just seed missing data

This is useful during development/demo to get a clean slate.
It does NOT affect the users table, vehicles, or Supabase Auth data.
"""

from dotenv import load_dotenv
from supabase import create_client
import os
import sys

# Load the same .env file used by the Flask app
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env file")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

seed_only = "--seed-only" in sys.argv


def clear_data():
    """Delete all transactional data (sessions, reservations, detections, etc.)."""
    tables_to_clear = [
        "gate_events",
        "detection_logs",
        "notifications",
        "payments",
        "subscriptions",
        "parking_sessions",
        "reservations",
    ]
    for table in tables_to_clear:
        try:
            supabase.table(table).delete().neq("id", 0).execute()
            print(f"  Cleared: {table}")
        except Exception as e:
            print(f"  Warning: Could not clear {table}: {e}")

    # Reset all spots to unoccupied
    try:
        supabase.table("parking_spots").update({
            "is_occupied": False,
            "is_reserved": False,
        }).neq("id", 0).execute()
        print("  All parking spots reset to free.")
    except Exception:
        pass


def seed_facility():
    """Create the default facility, floor, spots, and pricing if they don't exist."""
    # Check for existing facility
    existing = supabase.table("facilities").select("id").limit(1).execute()
    if existing.data:
        facility_id = existing.data[0]["id"]
        print(f"\n  Facility already exists (id={facility_id}), skipping creation.")
    else:
        result = supabase.table("facilities").insert({
            "name": "Sentra Main Parking",
            "address": "123 Colombo Road",
            "city": "Colombo",
            "total_spots": 32,
            "hourly_rate": 150,
        }).execute()
        facility_id = result.data[0]["id"]
        print(f"\n  Created facility: Sentra Main Parking (id={facility_id})")

    # Create ground floor
    floor_exists = (
        supabase.table("floors")
        .select("id")
        .eq("facility_id", facility_id)
        .limit(1)
        .execute()
    )
    floor_id = None
    if not floor_exists.data:
        floor_result = supabase.table("floors").insert({
            "facility_id": facility_id,
            "floor_number": 0,
            "name": "Ground Floor",
            "total_spots": 32,
        }).execute()
        floor_id = floor_result.data[0]["id"]
        print(f"  Created floor: Ground Floor (id={floor_id})")
    else:
        floor_id = floor_exists.data[0]["id"]
        print(f"  Floor already exists (id={floor_id})")

    # Create 32 parking spots (A-01 to A-32)
    spots_exist = (
        supabase.table("parking_spots")
        .select("id")
        .eq("facility_id", facility_id)
        .limit(1)
        .execute()
    )
    if not spots_exist.data:
        spots = []
        for i in range(1, 33):
            spots.append({
                "facility_id": facility_id,
                "floor_id": floor_id,
                "spot_name": f"A-{str(i).zfill(2)}",
                "spot_type": "regular",
                "is_occupied": False,
                "is_reserved": False,
            })
        supabase.table("parking_spots").insert(spots).execute()
        print(f"  Created 32 parking spots (A-01 to A-32)")
    else:
        print("  Spots already exist, skipping.")

    # Create default pricing plans
    plans_exist = (
        supabase.table("pricing_plans")
        .select("id")
        .eq("facility_id", facility_id)
        .limit(1)
        .execute()
    )
    if not plans_exist.data:
        plans = [
            {"facility_id": facility_id, "name": "Hourly Standard",  "plan_type": "hourly",      "rate": 150,    "description": "LKR 150 per hour, billed per started hour"},
            {"facility_id": facility_id, "name": "Daily Rate",       "plan_type": "daily",        "rate": 1000,   "description": "LKR 1,000 flat rate for up to 24 hours"},
            {"facility_id": facility_id, "name": "Monthly Pass",     "plan_type": "monthly",      "rate": 15000,  "description": "LKR 15,000 per month, unlimited parking"},
            {"facility_id": facility_id, "name": "Reservation Fee",  "plan_type": "reservation",  "rate": 200,    "description": "LKR 200 advance booking fee"},
        ]
        supabase.table("pricing_plans").insert(plans).execute()
        print("  Created 4 pricing plans (hourly, daily, monthly, reservation)")
    else:
        print("  Pricing plans already exist, skipping.")


try:
    if not seed_only:
        print("Step 1: Clearing transactional data...")
        clear_data()
    else:
        print("Seed-only mode: skipping data deletion.")

    print("\nStep 2: Seeding default facility...")
    seed_facility()

    print("\nDone! Database is ready.")

except Exception as e:
    print(f"\nReset failed: {e}")
