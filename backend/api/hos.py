"""
HOS (Hours of Service) calculation engine.
Property-carrying CMV, 70hr/8-day rule.

Duty statuses (FMCSA ELD grid):
  OFF  – Off Duty
  SB   – Sleeper Berth
  D    – Driving
  ON   – On Duty (not driving)

Rest model: 10-hour reset = 8 hr SB + 2 hr OFF.
This satisfies the sleeper-berth provision and is the standard
pattern for long-haul property-carrying drivers.
"""

from datetime import date, timedelta

AVG_SPEED_MPH        = 55
FUEL_STOP_INTERVAL   = 1000   # miles between fuel stops
FUEL_STOP_DURATION   = 0.5    # hours on-duty per fuel stop
PICKUP_DURATION      = 1.0    # hours on-duty at pickup
DROPOFF_DURATION     = 1.0    # hours on-duty at dropoff
MAX_DRIVING_PER_SHIFT = 11.0  # 11-hour driving limit
MAX_WINDOW_PER_SHIFT  = 14.0  # 14-hour on-duty window
REST_SB_MAIN         = 8.0    # sleeper berth block for reset
REST_OFF_TAIL        = 2.0    # off-duty tail for reset (total = 10 hr)
MAX_CYCLE_HOURS      = 70.0   # 70-hr / 8-day limit
BREAK_AFTER_DRIVING  = 8.0    # cumulative driving before mandatory 30-min break
BREAK_DURATION       = 0.5    # 30-minute break duration


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_trip(current_location, pickup_location, dropoff_location,
                   estimated_miles, cycle_used,
                   driver_name="", co_driver="", carrier="", truck_number="",
                   start_hour=0.0, drive_hours=0.0):
    """
    Main entry point.
    Returns { logs, stops, summary }.
    """
    total_miles       = estimated_miles
    fuel_stops_needed = int(total_miles // FUEL_STOP_INTERVAL)
    avg_speed         = _resolve_avg_speed(total_miles, drive_hours)

    tasks      = _build_task_list(total_miles, fuel_stops_needed, avg_speed)
    shift_days = _simulate_hos(tasks, cycle_used, driver_name, co_driver, carrier, truck_number, avg_speed)
    days       = _to_calendar_days(shift_days, start_hour, driver_name, co_driver, carrier, truck_number, avg_speed)
    stops      = _build_stops(total_miles, fuel_stops_needed)

    total_driving = sum(
        sum(e["hours"] for e in d["entries"] if e["status"] == "D")
        for d in days
    )
    total_rest = sum(
        sum(e["hours"] for e in d["entries"] if e["status"] in ("OFF", "SB"))
        for d in days
    )
    total_on_not_driving = sum(
        sum(e["hours"] for e in d["entries"] if e["status"] == "ON")
        for d in days
    )

    cycle_used_after  = cycle_used + total_driving + total_on_not_driving
    cycle_remaining   = max(0.0, MAX_CYCLE_HOURS - cycle_used_after)

    return {
        "logs":  days,
        "stops": stops,
        "summary": {
            "total_days":        len(days),
            "total_driving_hrs": round(total_driving, 2),
            "total_off_duty_hrs": round(total_rest, 2),
            "fuel_stops":        fuel_stops_needed,
            "cycle_remaining":   round(cycle_remaining, 2),
        },
    }


# ---------------------------------------------------------------------------
# Average speed resolver
# ---------------------------------------------------------------------------

def _resolve_avg_speed(total_miles, drive_hours):
    """
    Decide the average driving speed used to convert distance <-> driving hours.

    When the client passes the route's REAL driving duration (from the map
    provider's Directions result), derive the effective speed from it so the ELD
    log's driving hours match the actual route instead of a flat assumption.
    Fall back to AVG_SPEED_MPH when no duration is given, and ignore implausible
    values (garbled input) by requiring a sane long-haul band.
    """
    if drive_hours and drive_hours > 0 and total_miles > 0:
        speed = total_miles / drive_hours
        if 20.0 <= speed <= 80.0:
            return speed
    return AVG_SPEED_MPH


# ---------------------------------------------------------------------------
# Task list builder
# ---------------------------------------------------------------------------

def _build_task_list(total_miles, fuel_stops_needed, avg_speed=AVG_SPEED_MPH):
    """
    Ordered work tasks for the trip:
      Pickup → [Drive + Fuel Stop] × N → Drive (last) → Dropoff
    """
    tasks = [{"type": "on_duty", "label": "Pickup", "hours": PICKUP_DURATION}]

    segments    = fuel_stops_needed + 1
    seg_miles   = total_miles / segments
    seg_hours   = seg_miles / avg_speed

    for i in range(segments):
        tasks.append({
            "type":  "drive",
            "label": f"Drive Segment {i + 1}",
            "hours": seg_hours,
            "miles": seg_miles,
        })
        if i < fuel_stops_needed:
            tasks.append({
                "type":  "on_duty",
                "label": f"Fuel Stop {i + 1}",
                "hours": FUEL_STOP_DURATION,
            })

    tasks.append({"type": "on_duty", "label": "Dropoff", "hours": DROPOFF_DURATION})
    return tasks


# ---------------------------------------------------------------------------
# HOS simulator
# ---------------------------------------------------------------------------

def _simulate_hos(tasks, cycle_used_start, driver_name, co_driver, carrier, truck_number,
                  avg_speed=AVG_SPEED_MPH):
    """
    Walk through tasks enforcing all HOS rules, emitting daily log entries
    with statuses: OFF, SB, D, ON.
    """
    today = date.today()
    days  = []

    # --- mutable state via lists so inner functions can rebind ---
    state = {
        "day_idx":       0,
        "shift_driving": 0.0,   # driving hours in current shift
        "shift_window":  0.0,   # total on-duty window used
        "cumul_driving": 0.0,   # driving since last 30-min break
        "cycle_used":    cycle_used_start,
    }

    def new_day(idx):
        return {
            "day":          idx + 1,
            "date":         (today + timedelta(days=idx)).isoformat(),
            "driver":       driver_name,
            "co_driver":    co_driver,
            "carrier":      carrier,
            "truck_number": truck_number,
            "entries":      [],
            "miles":        0.0,
        }

    current_day = [new_day(0)]   # wrap in list for mutability in nested fns

    def push(status, label, hours):
        """Append an entry to the current day (merges consecutive same-status entries)."""
        if hours <= 0:
            return
        entries = current_day[0]["entries"]
        if entries and entries[-1]["status"] == status:
            entries[-1]["hours"] = round(entries[-1]["hours"] + hours, 4)
        else:
            entries.append({"status": status, "label": label, "hours": round(hours, 4)})

    def advance_day():
        """Close current day and open a new one."""
        days.append(current_day[0])
        state["day_idx"] += 1
        if state["day_idx"] > 30:
            raise ValueError("Trip would exceed 30 days — check your inputs.")
        current_day[0] = new_day(state["day_idx"])

    def take_rest():
        """
        10-hour mandatory rest:
          8 hr Sleeper Berth  (SB)
          2 hr Off Duty       (OFF)
        Splits across day boundaries automatically.
        Resets shift_driving, shift_window, and cumul_driving.
        """
        remaining_sb  = REST_SB_MAIN
        remaining_off = REST_OFF_TAIL

        # Push SB block, crossing midnight if needed
        while remaining_sb > 1e-9:
            push("SB", "Sleeper Berth", remaining_sb)
            remaining_sb = 0.0  # always fits — we don't track intra-day time position
            # If the day is now "full" we advance; for simplicity we let the
            # ELD renderer decide where midnight falls based on cumulative minutes.

        # Push OFF tail
        while remaining_off > 1e-9:
            push("OFF", "Off Duty", remaining_off)
            remaining_off = 0.0

        state["shift_driving"] = 0.0
        state["shift_window"]  = 0.0
        state["cumul_driving"] = 0.0

    def take_break():
        """30-minute mandatory break (OFF, not SB)."""
        push("OFF", "30-Min Break", BREAK_DURATION)
        state["cumul_driving"] = 0.0

    # --- main simulation loop ---
    for task in tasks:

        if task["type"] == "drive":
            remaining = task["hours"]

            while remaining > 1e-9:
                # 1. Take mandatory break if 8 hrs cumulative driving reached
                if state["cumul_driving"] >= BREAK_AFTER_DRIVING - 1e-9:
                    take_break()
                    state["shift_window"] += BREAK_DURATION

                # 2. Calculate how much we can drive right now
                drive_to_break   = BREAK_AFTER_DRIVING - state["cumul_driving"]
                shift_drive_left = MAX_DRIVING_PER_SHIFT - state["shift_driving"]
                window_left      = MAX_WINDOW_PER_SHIFT  - state["shift_window"]
                cycle_left       = MAX_CYCLE_HOURS       - state["cycle_used"]

                can_drive = min(remaining, drive_to_break,
                                shift_drive_left, window_left, cycle_left)

                if can_drive <= 1e-9:
                    # Determine why we're blocked
                    if cycle_left <= 1e-9:
                        raise ValueError(
                            "You don't have enough hours left in your 70-hour "
                            "cycle to finish this trip. Take a 34-hour restart to "
                            "reset your cycle, then plan the trip again — or lower "
                            "the cycle hours you've already used."
                        )
                    # Shift/window limit hit — take rest and continue
                    advance_day()
                    take_rest()
                    continue

                push("D", task["label"], can_drive)
                state["shift_driving"] += can_drive
                state["shift_window"]  += can_drive
                state["cumul_driving"] += can_drive
                state["cycle_used"]    += can_drive
                remaining              -= can_drive

                # 3. If shift limits now reached, rest before next driving
                if (state["shift_driving"] >= MAX_DRIVING_PER_SHIFT - 1e-9 or
                        state["shift_window"] >= MAX_WINDOW_PER_SHIFT - 1e-9):
                    advance_day()
                    take_rest()

        elif task["type"] == "on_duty":
            # If not enough window left, rest first
            window_left = MAX_WINDOW_PER_SHIFT - state["shift_window"]
            if task["hours"] > window_left + 1e-9:
                advance_day()
                take_rest()

            push("ON", task["label"], task["hours"])
            state["shift_window"] += task["hours"]
            state["cycle_used"]   += task["hours"]

    # Close the last open day
    if current_day[0]["entries"]:
        days.append(current_day[0])

    # Compute miles per day from driving entries
    for d in days:
        d["miles"] = round(
            sum(e["hours"] for e in d["entries"] if e["status"] == "D") * avg_speed,
            1,
        )

    return days


# ---------------------------------------------------------------------------
# Calendar-day converter
# ---------------------------------------------------------------------------

def _to_calendar_days(shift_days, start_hour, driver_name, co_driver, carrier, truck_number,
                      avg_speed=AVG_SPEED_MPH):
    """
    Convert shift-based HOS entries into true calendar days (midnight-to-midnight).
    Each entry gets a `start_min` field = absolute minute within its calendar day.
    Entries that cross midnight are split across two calendar days.
    """
    from datetime import date, timedelta
    today = date.today()

    # Flatten all entries from the shift simulation into one timeline
    flat = []
    for day in shift_days:
        for e in day["entries"]:
            flat.append(e)

    abs_minute = start_hour * 60   # e.g., 23.083 * 60 ≈ 1385 for 11:05 PM
    cal = {}                        # cal_day_index -> day dict

    for entry in flat:
        remaining = entry["hours"] * 60   # minutes

        while remaining > 1e-6:
            cal_idx      = int(abs_minute // 1440)
            min_in_day   = abs_minute % 1440
            available    = 1440.0 - min_in_day
            chunk        = min(remaining, available)

            if cal_idx not in cal:
                cal[cal_idx] = {
                    "day":          cal_idx + 1,
                    "date":         (today + timedelta(days=cal_idx)).isoformat(),
                    "driver":       driver_name,
                    "co_driver":    co_driver,
                    "carrier":      carrier,
                    "truck_number": truck_number,
                    "entries":      [],
                    "miles":        0.0,
                }

            entries = cal[cal_idx]["entries"]
            # Merge consecutive same-status entries
            if (entries and
                    entries[-1]["status"] == entry["status"] and
                    abs(entries[-1]["start_min"] + entries[-1]["hours"] * 60 - min_in_day) < 1e-3):
                entries[-1]["hours"] = round(entries[-1]["hours"] + chunk / 60, 4)
            else:
                entries.append({
                    "status":    entry["status"],
                    "label":     entry["label"],
                    "hours":     round(chunk / 60, 4),
                    "start_min": round(min_in_day, 2),
                })

            abs_minute += chunk
            remaining  -= chunk

    result = [cal[k] for k in sorted(cal.keys())]

    # Make every day span exactly midnight-to-midnight.
    for d in result:
        if d["entries"]:
            last = d["entries"][-1]
            end_min = last["start_min"] + last["hours"] * 60
            remaining = 1440.0 - end_min
            # A sub-minute gap is just floating-point drift from rounding each
            # entry's `hours` — the activity actually runs to midnight (and
            # continues on the next calendar day). Snap the final entry exactly
            # to 1440 so the duty line reaches the day boundary and lines up
            # with the next day's first entry. Appending an Off-Duty sliver
            # here instead would draw a vertical "jump" at midnight and emit a
            # phantom status-change remark for a transition that never happened.
            if abs(remaining) < 1.0:
                last["hours"] = round((1440.0 - last["start_min"]) / 60, 4)
            elif remaining >= 1.0:
                # Genuine idle time before midnight — pad with real Off Duty
                # so the line returns to row 1.
                d["entries"].append({
                    "status":    "OFF",
                    "label":     "Off Duty",
                    "hours":     round(remaining / 60, 4),
                    "start_min": round(end_min, 2),
                })

    for d in result:
        d["miles"] = round(
            sum(e["hours"] for e in d["entries"] if e["status"] == "D") * avg_speed, 1
        )

    return result


# ---------------------------------------------------------------------------
# Stops builder
# ---------------------------------------------------------------------------

def _build_stops(total_miles, fuel_stops_needed):
    stops   = [{"type": "start",   "label": "Current Location", "mile": 0}]
    segment = total_miles / (fuel_stops_needed + 1) if fuel_stops_needed else total_miles

    for i in range(fuel_stops_needed):
        stops.append({
            "type":  "fuel",
            "label": f"Fuel Stop {i + 1}",
            "mile":  round(segment * (i + 1), 1),
        })

    stops.append({"type": "pickup",  "label": "Pickup Location",  "mile": 0})
    stops.append({"type": "dropoff", "label": "Dropoff Location", "mile": total_miles})
    return stops
