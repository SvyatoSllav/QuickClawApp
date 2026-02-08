from django.urls import path
from .views import CreatePaymentView, YookassaWebhookView

# api/payments/
urlpatterns = [
    path('create/', CreatePaymentView.as_view(), name='create-payment'),
    path('webhook/yookassa/', YookassaWebhookView.as_view(), name='yookassa-webhook'),
]
