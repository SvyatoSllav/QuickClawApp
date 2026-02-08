from django.contrib import admin
from .models import Payment, Subscription


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['user', 'amount', 'currency', 'status', 'is_recurring', 'created_at']
    list_filter = ['status', 'is_recurring', 'currency']
    search_fields = ['user__email', 'yookassa_payment_id']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'is_active', 'auto_renew', 'status', 'current_period_end']
    list_filter = ['is_active', 'auto_renew', 'status']
    search_fields = ['user__email']
    readonly_fields = ['created_at', 'updated_at']
