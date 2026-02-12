from django.db import models
from django.contrib.auth.models import User


class TelegramBotUser(models.Model):
    telegram_id = models.BigIntegerField(unique=True, db_index=True)
    chat_id = models.BigIntegerField()
    username = models.CharField(max_length=255, blank=True)
    first_name = models.CharField(max_length=255, blank=True)
    last_name = models.CharField(max_length=255, blank=True)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='telegram_bot_user',
    )
    selected_model = models.CharField(max_length=50, default='claude-sonnet-4')
    pending_bot_token = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Telegram Bot User'
        verbose_name_plural = 'Telegram Bot Users'

    def __str__(self):
        name = self.username or self.first_name or str(self.telegram_id)
        return f'TG:{name}'
