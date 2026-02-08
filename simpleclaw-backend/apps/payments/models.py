from django.db import models
from django.contrib.auth.models import User


class Subscription(models.Model):
    """Подписка пользователя на сервис"""

    STATUS_CHOICES = [
        ('active', 'Активна'),
        ('cancelled', 'Отменена'),
        ('expired', 'Истекла'),
        ('past_due', 'Просрочена'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription')
    is_active = models.BooleanField(default=False)
    auto_renew = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    # Период подписки
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)

    # YooKassa данные для рекуррентных платежей
    yookassa_payment_method_id = models.CharField(max_length=255, blank=True)

    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Подписка'
        verbose_name_plural = 'Подписки'

    def __str__(self):
        return f'{self.user.email} — {self.status}'


class Payment(models.Model):
    """Запись о платеже"""

    STATUS_CHOICES = [
        ('pending', 'Ожидание'),
        ('succeeded', 'Успешно'),
        ('canceled', 'Отменён'),
        ('refunded', 'Возвращён'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='RUB')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    description = models.CharField(max_length=255, blank=True)

    # YooKassa данные
    yookassa_payment_id = models.CharField(max_length=255, unique=True, db_index=True)
    yookassa_status = models.CharField(max_length=50, blank=True)

    # Флаг: первый платёж (с сохранением метода) или рекуррентный
    is_recurring = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Платёж'
        verbose_name_plural = 'Платежи'

    def __str__(self):
        return f'{self.user.email} — {self.amount} {self.currency} — {self.status}'
