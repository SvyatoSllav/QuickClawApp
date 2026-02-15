from django.urls import path
from .views import CreatePaymentView, CreatePaymentWithTokenView, YookassaWebhookView

# api/payments/
urlpatterns = [
    path('create/', CreatePaymentView.as_view(), name='create-payment'),
    path('create-with-token/', CreatePaymentWithTokenView.as_view(), name='create-payment-with-token'),
    path('webhook/yookassa/', YookassaWebhookView.as_view(), name='yookassa-webhook'),
]
