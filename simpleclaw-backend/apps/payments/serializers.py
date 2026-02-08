from rest_framework import serializers
from .models import Payment, Subscription


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            'id', 'amount', 'currency', 'status', 'description',
            'is_recurring', 'created_at',
        ]


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = [
            'is_active', 'auto_renew', 'status',
            'current_period_start', 'current_period_end',
            'cancelled_at',
        ]
