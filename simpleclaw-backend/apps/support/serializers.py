from rest_framework import serializers


class SupportMessageSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=5000, min_length=1)
