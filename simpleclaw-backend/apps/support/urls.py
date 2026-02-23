from django.urls import path
from .views import SendSupportMessageView

urlpatterns = [
    path('', SendSupportMessageView.as_view(), name='send-support-message'),
]
