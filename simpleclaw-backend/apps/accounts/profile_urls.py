from django.urls import path
from .views import ProfileView, ProfileUsageView, PaymentHistoryView

# api/profile/
urlpatterns = [
    path('', ProfileView.as_view(), name='profile'),
    path('usage/', ProfileUsageView.as_view(), name='profile-usage'),
    path('payments/', PaymentHistoryView.as_view(), name='payment-history'),
]
