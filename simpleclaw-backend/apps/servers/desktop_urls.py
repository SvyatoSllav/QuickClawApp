from django.urls import path
from .desktop_views import (
    DesktopRegisterView,
    DesktopStatusView,
    DesktopUsageView,
    DesktopRefreshKeyView,
    DesktopCreatePaymentView,
    DesktopPaymentWebhookView,
)

urlpatterns = [
    path('desktop/register/', DesktopRegisterView.as_view(), name='desktop-register'),
    path('desktop/status/', DesktopStatusView.as_view(), name='desktop-status'),
    path('desktop/usage/', DesktopUsageView.as_view(), name='desktop-usage'),
    path('desktop/refresh-key/', DesktopRefreshKeyView.as_view(), name='desktop-refresh-key'),
    path('desktop/pay/', DesktopCreatePaymentView.as_view(), name='desktop-pay'),
    path('desktop/webhook/', DesktopPaymentWebhookView.as_view(), name='desktop-webhook'),
]
