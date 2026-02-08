from django.urls import path
from .views import SubscriptionView, CancelSubscriptionView, ReactivateSubscriptionView

# api/subscription/
urlpatterns = [
    path('', SubscriptionView.as_view(), name='subscription'),
    path('cancel/', CancelSubscriptionView.as_view(), name='cancel-subscription'),
    path('reactivate/', ReactivateSubscriptionView.as_view(), name='reactivate-subscription'),
]
