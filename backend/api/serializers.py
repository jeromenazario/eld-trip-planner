from rest_framework import serializers


class TripRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=300)
    pickup_location = serializers.CharField(max_length=300)
    dropoff_location = serializers.CharField(max_length=300)
    estimated_miles = serializers.FloatField(min_value=1)
    cycle_used = serializers.FloatField(min_value=0, max_value=70)
    # Real driving duration (hours) for the route, from the map provider's
    # Directions result. When present, the HOS engine derives driving time from
    # this instead of a flat average-speed assumption. 0 = not provided.
    drive_hours = serializers.FloatField(required=False, min_value=0, default=0)
    driver_name = serializers.CharField(required=False, default="", allow_blank=True)
    co_driver = serializers.CharField(required=False, default="", allow_blank=True)
    carrier = serializers.CharField(required=False, default="", allow_blank=True)
    truck_number = serializers.CharField(required=False, default="", allow_blank=True)
    departure_time = serializers.CharField(required=False, default="00:00", allow_blank=True)  # HH:MM
    # Coordinates the frontend already resolved via Places autocomplete, as
    # [lat, lng]. When present the backend reuses them and SKIPS re-geocoding
    # that location — the autocomplete already did the geocode. Empty = geocode
    # server-side as a fallback (e.g. a freehand-typed location).
    current_coords = serializers.ListField(
        child=serializers.FloatField(), min_length=2, max_length=2, required=False, default=list)
    pickup_coords = serializers.ListField(
        child=serializers.FloatField(), min_length=2, max_length=2, required=False, default=list)
    dropoff_coords = serializers.ListField(
        child=serializers.FloatField(), min_length=2, max_length=2, required=False, default=list)
    # Optional geometry of the route the driver actually selected, as [[lat, lng], ...].
    # When present, stops and gas-station lookups are placed along THIS path so the
    # drawn line and the markers always agree.
    # max_length caps the payload so a caller can't POST an unbounded point list
    # (the backend iterates every point for interpolation). A detailed coast-to-
    # coast route is well under this ceiling.
    route_geometry = serializers.ListField(
        child=serializers.ListField(
            child=serializers.FloatField(), min_length=2, max_length=2
        ),
        required=False,
        default=list,
        max_length=50000,
    )
