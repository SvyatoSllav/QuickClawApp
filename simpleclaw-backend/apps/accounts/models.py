from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    """Профиль пользователя с данными подписки и OpenClaw"""

    MODEL_CHOICES = [
        ('claude-sonnet-4', 'Claude Sonnet 4'),
        ('claude-opus-4.5', 'Claude Opus 4.5'),
        ('claude-sonnet-4.5', 'Claude Sonnet 4.5'),
        ('claude-haiku-4.5', 'Claude Haiku 4.5'),
        ('gpt-4o', 'GPT-4o'),
        ('gemini-3-flash', 'Gemini 3 Flash'),
        ('gemini-2.5-flash', 'Gemini 2.5 Flash'),
        ('minimax-m2.5', 'MiniMax M2.5'),
    ]

    SUBSCRIPTION_STATUS_CHOICES = [
        ('none', 'Нет подписки'),
        ('pending', 'Ожидание оплаты'),
        ('active', 'Активна'),
        ('cancelled', 'Отменена'),
        ('expired', 'Истекла'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')

    # Google OAuth
    google_id = models.CharField(max_length=255, blank=True, db_index=True)
    avatar_url = models.URLField(blank=True)

    # Apple OAuth
    apple_id = models.CharField(max_length=255, blank=True, db_index=True)

    # OAuth provider tracking
    auth_provider = models.CharField(max_length=10, blank=True, choices=[('google', 'Google'), ('apple', 'Apple')])
    last_oauth_verified_at = models.DateTimeField(null=True, blank=True)

    # Telegram
    telegram_bot_token = models.CharField(max_length=255, blank=True)
    telegram_bot_username = models.CharField(max_length=255, blank=True)
    telegram_bot_validated = models.BooleanField(default=False)

    # Выбор модели
    selected_model = models.CharField(max_length=50, choices=MODEL_CHOICES, default='claude-sonnet-4')

    # Подписка
    subscription_status = models.CharField(max_length=20, choices=SUBSCRIPTION_STATUS_CHOICES, default='none')
    subscription_started_at = models.DateTimeField(null=True, blank=True)
    subscription_expires_at = models.DateTimeField(null=True, blank=True)

    # OpenRouter
    openrouter_api_key = models.CharField(max_length=255, blank=True)
    openrouter_key_id = models.CharField(max_length=255, blank=True)
    tokens_used_usd = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    token_limit_usd = models.DecimalField(max_digits=8, decimal_places=2, default=15.00)

    # ClawdMatrix Engine
    clawdmatrix_enabled = models.BooleanField(default=False, verbose_name='ClawdMatrix Engine')
    clawdmatrix_custom_skills = models.JSONField(
        default=dict, blank=True,
        verbose_name='Custom ClawdMatrix Skills',
        help_text='Per-user skill overrides (merged with defaults)',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Профиль пользователя'
        verbose_name_plural = 'Профили пользователей'

    def __str__(self):
        return f'{self.user.email} ({self.subscription_status})'


class AuditLog(models.Model):
    """Лог действий для отладки"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    action = models.CharField(max_length=100)
    details = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Лог'
        verbose_name_plural = 'Логи'

    def __str__(self):
        return f'{self.action} — {self.user} — {self.created_at}'
