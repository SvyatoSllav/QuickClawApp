from django.urls import path
from .views import GoogleAuthView, AppleAuthView, LogoutView, CurrentUserView, ProfileView, ProfileUsageView, PaymentHistoryView

# api/auth/
urlpatterns = [
    path('google/', GoogleAuthView.as_view(), name='google-auth'),
    path('apple/', AppleAuthView.as_view(), name='apple-auth'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('usage/', ProfileUsageView.as_view(), name='usage'),
    path('payments/', PaymentHistoryView.as_view(), name='payment-history'),
]
