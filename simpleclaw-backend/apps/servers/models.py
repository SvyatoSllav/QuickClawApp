from django.db import models
from apps.accounts.models import UserProfile


class Server(models.Model):
    """Server for OpenClaw - created via TimeWeb API"""

    STATUS_CHOICES = [
        ('creating', 'Создается'),
        ('provisioning', 'Настраивается'),
        ('active', 'Активен'),
        ('error', 'Ошибка'),
        ('deactivated', 'Деактивирован'),
    ]

    profile = models.OneToOneField(
        UserProfile, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='server',
    )

    # TimeWeb server data
    timeweb_server_id = models.CharField(max_length=100, blank=True, db_index=True)
    
    # SSH connection data
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    ssh_user = models.CharField(max_length=50, default='root')
    ssh_password = models.CharField(max_length=255, blank=True)
    ssh_port = models.IntegerField(default=22)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='creating')
    openclaw_running = models.BooleanField(default=False)

    DEPLOY_STAGE_CHOICES = [
        ('', 'Нет'),
        ('pool_assigned', 'Сервер назначен'),
        ('configuring_keys', 'Настройка ключей'),
        ('deploying_openclaw', 'Развёртывание OpenClaw'),
        ('installing_agents', 'Установка агентов'),
        ('configuring_search', 'Настройка поиска'),
        ('ready', 'Готов'),
    ]
    deployment_stage = models.CharField(
        max_length=30, choices=DEPLOY_STAGE_CHOICES,
        default='', blank=True,
    )

    # OpenClaw path on server
    openclaw_path = models.CharField(max_length=255, default='/root/openclaw')

    # ClawdMatrix Engine
    clawdmatrix_installed = models.BooleanField(default=False)

    # Gateway token for HTTP chat endpoint
    gateway_token = models.CharField(max_length=255, blank=True)

    # Logs
    last_error = models.TextField(blank=True)
    last_health_check = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Сервер'
        verbose_name_plural = 'Серверы'

    def __str__(self):
        user_email = self.profile.user.email if self.profile else 'free'
        return f'{self.ip_address or "pending"} — {self.status} ({user_email})'
