from rest_framework import serializers


class TripRequestSerializer(serializers.Serializer):
    current_location = serializers.CharField()
    pickup_location = serializers.CharField()
    dropoff_location = serializers.CharField()
    estimated_miles = serializers.FloatField(min_value=1)
    cycle_used = serializers.FloatField(min_value=0, max_value=70)
    driver_name = serializers.CharField(required=False, default="", allow_blank=True)
    co_driver = serializers.CharField(required=False, default="", allow_blank=True)
    carrier = serializers.CharField(required=False, default="", allow_blank=True)
    truck_number = serializers.CharField(required=False, default="", allow_blank=True)
    departure_time = serializers.CharField(required=False, default="00:00", allow_blank=True)  # HH:MM
