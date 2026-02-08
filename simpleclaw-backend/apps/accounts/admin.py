from django.contrib import admin
from .models import UserProfile, AuditLog


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'subscription_status', 'selected_model', 'telegram_bot_validated', 'created_at']
    list_filter = ['subscription_status', 'selected_model', 'telegram_bot_validated']
    search_fields = ['user__email', 'user__username', 'google_id']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'user', 'created_at']
    list_filter = ['action']
    search_fields = ['action', 'user__email']
    readonly_fields = ['created_at']
