from django.urls import path
from .views import ValidateTelegramTokenView

# api/telegram/
urlpatterns = [
    path('validate/', ValidateTelegramTokenView.as_view(), name='validate-telegram'),
]
