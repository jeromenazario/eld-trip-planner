import os
import math
import requests
import polyline as pl
from concurrent.futures import ThreadPoolExecutor
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import TripRequestSerializer
from .hos import calculate_trip


def health(request):
    """
    Lightweight liveness probe for uptime pings / keep-warm crons.
    Plain Django response — no DRF, no throttle, no external calls — so a
    scheduled ping can keep the free-tier dyno awake without touching the
    heavier plan-trip endpoint or consuming its rate-limit budget.
    """
    return JsonResponse({"status": "ok"})


def _parse_time(t):
    """Convert 'HH:MM' string to fractional hours (e.g. '23:05' → 23.083)."""
    try:
        h, m = map(int, (t or "00:00").split(":"))
        return h + m / 60.0
    except Exception:
        return 0.0


# ---------------------------------------------------------------------------
# Geocoding & routing helpers
# ---------------------------------------------------------------------------

def geocode(location_str, api_key):
    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": location_str, "key": api_key},
            timeout=10,
        )
        data = resp.json()
        if data.get("results"):
            loc = data["results"][0]["geometry"]["location"]
            return {
                "lat":  loc["lat"],
                "lng":  loc["lng"],
                "name": data["results"][0]["formatted_address"],
            }
    except Exception:
        pass
    return None


def haversine_miles(lat1, lng1, lat2, lng2):
    """Great-circle distance in miles between two lat/lng points."""
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def route_length_miles(coords):
    """Total great-circle length of a (lat, lng) polyline, in miles."""
    total = 0.0
    for i in range(1, len(coords)):
        total += haversine_miles(coords[i - 1][0], coords[i - 1][1],
                                 coords[i][0], coords[i][1])
    return total


def interpolate_along_route(coords, target_mile):
    """
    Given a list of (lat, lng) coords forming a polyline,
    return the (lat, lng) that lies `target_mile` miles from the start.
    """
    accumulated = 0.0
    for i in range(1, len(coords)):
        lat1, lng1 = coords[i - 1]
        lat2, lng2 = coords[i]
        seg = haversine_miles(lat1, lng1, lat2, lng2)
        if accumulated + seg >= target_mile:
            frac = (target_mile - accumulated) / seg if seg > 0 else 0
            lat = lat1 + frac * (lat2 - lat1)
            lng = lng1 + frac * (lng2 - lng1)
            return lat, lng
        accumulated += seg
    # past end — return last point
    return coords[-1]


def nearest_truck_stop(lat, lng, api_key):
    """
    Find the nearest truck stop or rest area via Google Places Nearby Search.
    Falls back to gas station if no truck stop found.
    """
    for keyword in ["truck stop", "rest area", "travel plaza"]:
        try:
            resp = requests.get(
                "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                params={
                    "location": f"{lat},{lng}",
                    "rankby":   "distance",
                    "keyword":  keyword,
                    "key":      api_key,
                },
                timeout=10,
            )
            results = resp.json().get("results", [])
            if results:
                place = results[0]
                loc = place["geometry"]["location"]
                return {
                    "name":    place.get("name", "Rest Stop"),
                    "address": place.get("vicinity", ""),
                    "lat":     loc["lat"],
                    "lng":     loc["lng"],
                }
        except Exception:
            pass
    return None


def nearest_gas_station(lat, lng, api_key):
    """
    Use Google Places Nearby Search to find the closest gas station
    to the given coordinate. Returns a dict with name, lat, lng, address.
    """
    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
            params={
                "location": f"{lat},{lng}",
                "rankby":   "distance",
                "type":     "gas_station",
                "key":      api_key,
            },
            timeout=10,
        )
        data = resp.json()
        results = data.get("results", [])
        if results:
            place = results[0]
            loc = place["geometry"]["location"]
            return {
                "name":    place.get("name", "Gas Station"),
                "address": place.get("vicinity", ""),
                "lat":     loc["lat"],
                "lng":     loc["lng"],
            }
    except Exception:
        pass
    return None


def get_route_with_coords(waypoints, api_key):
    """
    Fetch driving route from Google Directions API.
    Returns (geojson, decoded_coords_list) or (None, []).
    """
    if len(waypoints) < 2:
        return None, []
    try:
        params = {
            "origin":      f"{waypoints[0]['lat']},{waypoints[0]['lng']}",
            "destination": f"{waypoints[-1]['lat']},{waypoints[-1]['lng']}",
            "mode":        "driving",
            "key":         api_key,
        }
        if len(waypoints) > 2:
            params["waypoints"] = "|".join(
                f"{p['lat']},{p['lng']}" for p in waypoints[1:-1]
            )
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/directions/json",
            params=params,
            timeout=15,
        )
        data = resp.json()
        if data.get("routes"):
            route0 = data["routes"][0]
            # Build FULL-resolution geometry from each step's polyline.
            # routes[0].overview_polyline is heavily simplified by Google — it
            # drops intermediate points, so the drawn line cuts corners, misses
            # roads, and on long legs "skips" straight across the map. Decoding
            # every step keeps the line glued to the actual roads.
            coords = []
            for leg in route0.get("legs", []):
                for step in leg.get("steps", []):
                    pts = step.get("polyline", {}).get("points")
                    if not pts:
                        continue
                    seg = pl.decode(pts)  # list of (lat, lng)
                    # consecutive steps share a vertex — drop the duplicate
                    if coords and seg and coords[-1] == seg[0]:
                        seg = seg[1:]
                    coords.extend(seg)
            # Fallback: if steps were unavailable, use the overview polyline
            if not coords:
                coords = pl.decode(route0["overview_polyline"]["points"])
            geojson = {
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "geometry": {
                        "type":        "LineString",
                        "coordinates": [[lng, lat] for lat, lng in coords],
                    },
                    "properties": {},
                }],
            }
            return geojson, coords
    except Exception:
        pass
    return None, []


# ---------------------------------------------------------------------------
# View
# ---------------------------------------------------------------------------

class PlanTripView(APIView):
    def post(self, request):
        ser = TripRequestSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        data    = ser.validated_data
        api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")

        # 1. Geocode the three locations — in parallel. They're independent
        #    network round-trips, so running them concurrently collapses three
        #    sequential calls into roughly one call's worth of latency.
        with ThreadPoolExecutor(max_workers=3) as ex:
            current, pickup, dropoff = ex.map(
                lambda loc: geocode(loc, api_key),
                [data["current_location"], data["pickup_location"], data["dropoff_location"]],
            )

        # 2. Resolve the route geometry.
        #    If the client passed the geometry of the route the driver actually
        #    selected, use it verbatim so the drawn line, the interpolated stops,
        #    and the gas-station lookups all reference the SAME path. Otherwise
        #    compute our own route through the pickup waypoint.
        client_geom = data.get("route_geometry") or []
        if len(client_geom) >= 2:
            route_coords = [(pt[0], pt[1]) for pt in client_geom]
            route = {
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "geometry": {
                        "type":        "LineString",
                        "coordinates": [[lng, lat] for lat, lng in route_coords],
                    },
                    "properties": {},
                }],
            }
        else:
            waypoints          = [p for p in [current, pickup, dropoff] if p]
            route, route_coords = get_route_with_coords(waypoints, api_key) \
                if len(waypoints) >= 2 else (None, [])

        # 3. Run HOS calculation
        try:
            result = calculate_trip(
                current_location  = data["current_location"],
                pickup_location   = data["pickup_location"],
                dropoff_location  = data["dropoff_location"],
                estimated_miles   = data["estimated_miles"],
                cycle_used        = data["cycle_used"],
                driver_name       = data.get("driver_name", ""),
                co_driver         = data.get("co_driver", ""),
                carrier           = data.get("carrier", ""),
                truck_number      = data.get("truck_number", ""),
                start_hour        = _parse_time(data.get("departure_time", "00:00")),
                drive_hours       = data.get("drive_hours", 0),
            )
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Build rest stop entries from cumulative day miles
        #    A rest happens at the end of every driving day except the last
        logs = result["logs"]
        cumulative = 0.0
        for i, day in enumerate(logs[:-1]):   # skip last day — trip ends there
            cumulative += day.get("miles", 0)
            if cumulative > 0 and cumulative < data["estimated_miles"]:
                result["stops"].append({
                    "type":  "rest",
                    "label": f"Rest Stop (Day {day['day']} end)",
                    "mile":  round(cumulative, 1),
                })

        # 5. Attach real coordinates to every stop
        total_miles  = data["estimated_miles"]
        # The stop "mile" values are fractions of the user's estimated distance,
        # but the actual drawn route may be a slightly different length. Map each
        # stop to the same fraction of the REAL polyline so it sits on the line.
        actual_miles = route_length_miles(route_coords) if route_coords else total_miles

        def route_point(mile):
            frac = (mile / total_miles) if total_miles else 0.0
            frac = max(0.0, min(1.0, frac))
            return interpolate_along_route(route_coords, frac * actual_miles)

        stops = result["stops"]

        # Endpoints already have coordinates from geocoding — assign them directly
        # (no network needed).
        for stop in stops:
            stype = stop["type"]
            if stype == "start" and current:
                stop.update(lat=current["lat"], lng=current["lng"], name=data["current_location"])
            elif stype == "pickup" and pickup:
                stop.update(lat=pickup["lat"], lng=pickup["lng"], name=data["pickup_location"])
            elif stype == "dropoff" and dropoff:
                stop.update(lat=dropoff["lat"], lng=dropoff["lng"], name=data["dropoff_location"])

        # Fuel and rest stops each need a Places lookup along the route. Those are
        # independent network calls, so resolve them all in parallel instead of
        # one-at-a-time — this is the bulk of the request's latency.
        def resolve_stop_place(stop):
            lat, lng = route_point(stop["mile"])
            if stop["type"] == "fuel":
                place = nearest_gas_station(lat, lng, api_key) if api_key else None
            else:  # rest
                place = nearest_truck_stop(lat, lng, api_key) if api_key else None
            return stop, place, lat, lng

        lookup_stops = [s for s in stops if s["type"] in ("fuel", "rest")] if route_coords else []
        if lookup_stops:
            with ThreadPoolExecutor(max_workers=min(8, len(lookup_stops))) as ex:
                for stop, place, lat, lng in ex.map(resolve_stop_place, lookup_stops):
                    if place:
                        stop.update(lat=place["lat"], lng=place["lng"],
                                    name=place["name"], address=place["address"])
                    else:
                        stop.update(lat=lat, lng=lng)

        return Response({
            "logs":     result["logs"],
            "route":    route,
            "stops":    stops,
            "summary":  result["summary"],
            "geocoded": {"current": current, "pickup": pickup, "dropoff": dropoff},
        })
