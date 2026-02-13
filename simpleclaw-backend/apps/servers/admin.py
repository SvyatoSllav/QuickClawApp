from django.contrib import admin
from .models import Server


@admin.register(Server)
class ServerAdmin(admin.ModelAdmin):
    list_display = ['ip_address', 'status', 'openclaw_running', 'clawdmatrix_installed', 'profile', 'last_health_check']
    list_filter = ['status', 'openclaw_running', 'clawdmatrix_installed']
    search_fields = ['ip_address', 'profile__user__email']
    readonly_fields = ['created_at', 'updated_at', 'last_health_check']
    fieldsets = (
        ('SSH подключение', {
            'fields': ('ip_address', 'ssh_user', 'ssh_password', 'ssh_port'),
        }),
        ('Статус', {
            'fields': ('status', 'openclaw_running', 'openclaw_path', 'last_error', 'last_health_check'),
        }),
        ('Привязка', {
            'fields': ('profile',),
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at'),
        }),
    )
