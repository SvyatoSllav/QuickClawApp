from django.urls import path
from .views import ValidateTelegramTokenView, ApprovePairingView

# api/telegram/
urlpatterns = [
    path('validate/', ValidateTelegramTokenView.as_view(), name='validate-telegram'),
    path('approve-pairing/', ApprovePairingView.as_view(), name='approve-pairing'),
]
