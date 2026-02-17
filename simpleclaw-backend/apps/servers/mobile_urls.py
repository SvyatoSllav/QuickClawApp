from django.urls import path
from .mobile_views import MobileChatConfigView

urlpatterns = [
    path('mobile/chat-config/', MobileChatConfigView.as_view(), name='mobile-chat-config'),
]
