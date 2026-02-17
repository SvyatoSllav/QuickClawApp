from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    subscription_status = serializers.SerializerMethodField()
    subscription_started_at = serializers.SerializerMethodField()
    subscription_expires_at = serializers.SerializerMethodField()
    auto_renew = serializers.SerializerMethodField()
    cancellation_scheduled = serializers.SerializerMethodField()
    cancelled_at = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            "selected_model", "subscription_status", "subscription_started_at",
            "subscription_expires_at", "auto_renew", "cancellation_scheduled",
            "cancelled_at", "telegram_bot_username", "telegram_bot_validated",
            "avatar_url", "tokens_used_usd", "token_limit_usd",
            "clawdmatrix_enabled",
        ]

    def get_subscription_status(self, obj):
        try:
            sub = obj.user.subscription
            if sub.is_active:
                if not sub.auto_renew and sub.cancelled_at:
                    return "cancelling"
                return "active"
            return sub.status or "none"
        except Exception:
            pass
        return obj.subscription_status if obj.subscription_status else "none"

    def get_subscription_started_at(self, obj):
        try:
            sub = obj.user.subscription
            if sub.current_period_start:
                return sub.current_period_start
        except Exception:
            pass
        return obj.subscription_started_at if obj.subscription_started_at else None

    def get_subscription_expires_at(self, obj):
        try:
            sub = obj.user.subscription
            if sub.current_period_end:
                return sub.current_period_end
        except Exception:
            pass
        return obj.subscription_expires_at if obj.subscription_expires_at else None

    def get_auto_renew(self, obj):
        try:
            sub = obj.user.subscription
            return sub.auto_renew
        except Exception:
            return False

    def get_cancellation_scheduled(self, obj):
        try:
            sub = obj.user.subscription
            return sub.is_active and not sub.auto_renew and sub.cancelled_at is not None
        except Exception:
            return False

    def get_cancelled_at(self, obj):
        try:
            sub = obj.user.subscription
            return sub.cancelled_at
        except Exception:
            return None


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "profile"]


class ProfileUpdateSerializer(serializers.Serializer):
    selected_model = serializers.ChoiceField(
        choices=[
            "claude-sonnet-4", "claude-opus-4.5", "claude-sonnet-4.5", "claude-haiku-4.5",
            "gpt-4o", "gemini-3-flash", "gemini-2.5-flash", "minimax-m2.5",
        ],
        required=False,
    )
    clawdmatrix_enabled = serializers.BooleanField(required=False)
