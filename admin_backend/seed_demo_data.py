"""
seed_demo_data.py - Realistic parking history for demos
=========================================================
Fills a facility with past, completed parking sessions so the Reports page
and dashboard show realistic data: weekday morning and evening rush hours,
quiet Sundays, regular commuters, short visits, pending payments and
subscriptions.

Only finished sessions are created (every vehicle has already left), so
live state is never touched: spots stay free and real LPR entries work as
usual. No spot is ever double-booked; when the car park is full, arrivals
are turned away, like in reality.

Every inserted row id is saved to .demo_seed.json, and --clear deletes
exactly those rows and nothing else.

Usage:
  cd admin_backend
  python seed_demo_data.py                  # 30 days for facility 1
  python seed_demo_data.py --days 60 --facility 2
  python seed_demo_data.py --dry-run        # show what would be inserted
  python seed_demo_data.py --clear          # remove the demo data again
"""

import argparse
import json
import os
import random
import sys
from datetime import datetime, time, timedelta, timezone
from math import ceil
from pathlib import Path
from zoneinfo import ZoneInfo

MANIFEST = Path(__file__).with_name(".demo_seed.json")
LOCAL_TZ = ZoneInfo(os.getenv("REPORT_TIMEZONE", "Asia/Colombo"))
BATCH_SIZE = 500

PROVINCES = ["WP", "WP", "WP", "WP", "CP", "SP", "NW", "SG", "UP", "NC", "EP"]
LETTERS = "ABCDEFGHIJKLMNPQRSTUVWXYZ"

# Arrivals per day by weekday (Mon=0 .. Sun=6)
DAILY_ARRIVALS = [62, 66, 64, 68, 72, 44, 24]

# Relative arrival weight per hour: weekdays have commuter peaks,
# weekends a midday peak. The car park is closed overnight.
WEEKDAY_HOURS = [
    0,
    0,
    0,
    0,
    0,
    0,
    2,
    9,
    16,
    11,
    6,
    5,
    7,
    6,
    5,
    6,
    9,
    12,
    8,
    4,
    2,
    1,
    0,
    0,
]
WEEKEND_HOURS = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    3,
    6,
    9,
    11,
    12,
    11,
    9,
    8,
    7,
    6,
    5,
    4,
    2,
    1,
    0,
    0,
]


def make_plate(rng):
    """A Sri Lankan style plate, e.g. 'WP CAB-1234'."""
    letters = "".join(rng.choice(LETTERS) for _ in range(rng.choice((2, 3))))
    return f"{rng.choice(PROVINCES)} {letters}-{rng.randint(1000, 9999)}"


def _stay_minutes(rng, local_arrival, commuter):
    """Office workers stay all day; visitors from 20 minutes to a few hours."""
    if commuter and local_arrival.weekday() < 5 and 7 <= local_arrival.hour <= 9:
        return int(rng.gauss(510, 45))  # ~8.5 hours
    return int(min(max(rng.lognormvariate(4.4, 0.7), 15), 360))  # median ~80 min


def generate_sessions(facility_id, spots, hourly_rate, days, now=None, seed=42):
    """
    Build completed parking sessions for the last `days` days (pure function).

    `spots` is a list of {"id", "spot_name"}. Returns session dicts ready to
    insert into parking_sessions.
    """
    rng = random.Random(seed)
    now = now or datetime.now(timezone.utc)
    commuters = [make_plate(rng) for _ in range(45)]
    visitors = [make_plate(rng) for _ in range(400)]
    subscribers = set(rng.sample(commuters, 8))
    busy_until = {s["id"]: now - timedelta(days=days + 1) for s in spots}

    arrivals = []
    today = now.astimezone(LOCAL_TZ).date()
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        weekday = day.weekday()
        weights = WEEKDAY_HOURS if weekday < 5 else WEEKEND_HOURS
        count = max(0, int(rng.gauss(DAILY_ARRIVALS[weekday], 6)))
        for _ in range(count):
            hour = rng.choices(range(24), weights=weights)[0]
            local = datetime.combine(day, time(hour), tzinfo=LOCAL_TZ) + timedelta(
                minutes=rng.randint(0, 59), seconds=rng.randint(0, 59)
            )
            arrivals.append(local)
    arrivals.sort()

    sessions = []
    for local_entry in arrivals:
        commuter = rng.random() < 0.45
        plate = rng.choice(commuters if commuter else visitors)
        minutes = max(15, _stay_minutes(rng, local_entry, commuter))
        entry = local_entry.astimezone(timezone.utc)
        exit_ = entry + timedelta(minutes=minutes)
        if exit_ >= now:
            continue  # demo data contains finished sessions only

        free = [s for s in spots if busy_until[s["id"]] <= entry]
        if not free:
            continue  # car park full: the vehicle is turned away
        spot = rng.choice(free)
        busy_until[spot["id"]] = exit_

        if plate in subscribers:
            session_type, amount, payment_status = "subscription", 0, "waived"
        else:
            session_type = "reserved" if rng.random() < 0.15 else "walk_in"
            amount = max(1, ceil(minutes / 60)) * hourly_rate
            payment_status = "paid" if rng.random() < 0.85 else "pending"

        sessions.append(
            {
                "facility_id": facility_id,
                "spot_id": spot["id"],
                "spot_name": spot["spot_name"],
                "plate_number": plate,
                "entry_time": entry.isoformat(),
                "exit_time": exit_.isoformat(),
                "duration_minutes": minutes,
                "amount": amount,
                "payment_status": payment_status,
                "session_type": session_type,
                "entry_method": rng.choices(
                    ["lpr", "manual", "qr_code"], weights=[90, 7, 3]
                )[0],
            }
        )
    return sessions


def _load_manifest():
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {"parking_sessions": []}


def _save_manifest(manifest):
    MANIFEST.write_text(json.dumps(manifest, indent=2))


def seed(supabase, facility_id, days, dry_run=False):
    facility = (
        supabase.table("facilities")
        .select("id, name, hourly_rate")
        .eq("id", facility_id)
        .limit(1)
        .execute()
    ).data
    if not facility:
        sys.exit(f"ERROR: facility {facility_id} does not exist")
    spots = (
        supabase.table("parking_spots")
        .select("id, spot_name")
        .eq("facility_id", facility_id)
        .eq("is_active", True)
        .execute()
    ).data
    if not spots:
        sys.exit(f"ERROR: facility {facility_id} has no active spots")

    rate = facility[0].get("hourly_rate") or 150
    sessions = generate_sessions(facility_id, spots, rate, days)
    revenue = sum(s["amount"] for s in sessions)
    print(
        f"{facility[0]['name']}: {len(sessions)} sessions over {days} days, "
        f"{len(spots)} spots, LKR {revenue:,} billed"
    )
    if dry_run:
        print("Dry run: nothing was inserted.")
        return

    manifest = _load_manifest()
    for i in range(0, len(sessions), BATCH_SIZE):
        end = i + BATCH_SIZE
        rows = (
            supabase.table("parking_sessions").insert(sessions[i:end]).execute()
        ).data
        manifest["parking_sessions"].extend(r["id"] for r in rows)
        _save_manifest(manifest)  # save after every batch so --clear always works
    print(f"Inserted. Remove later with: python {Path(__file__).name} --clear")


def clear(supabase):
    manifest = _load_manifest()
    ids = manifest.get("parking_sessions", [])
    if not ids:
        print("No demo data recorded in .demo_seed.json; nothing to remove.")
        return
    for i in range(0, len(ids), BATCH_SIZE):
        end = i + BATCH_SIZE
        supabase.table("parking_sessions").delete().in_("id", ids[i:end]).execute()
    MANIFEST.unlink()
    print(f"Removed {len(ids)} demo sessions.")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--facility", type=int, default=1)
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--clear", action="store_true")
    args = parser.parse_args()

    from dotenv import load_dotenv
    from supabase import create_client

    load_dotenv()
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env")
    supabase = create_client(url, key)

    if args.clear:
        clear(supabase)
    else:
        seed(supabase, args.facility, min(max(args.days, 1), 365), args.dry_run)


if __name__ == "__main__":
    main()
