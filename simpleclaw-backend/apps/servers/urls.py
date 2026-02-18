from django.urls import path
from .views import ServerStatusView, RedeployView, ServerPoolStatusView, ApprovePairingView

# api/
urlpatterns = [
    path('server/status/', ServerStatusView.as_view(), name='server-status'),
    path('server/redeploy/', RedeployView.as_view(), name='server-redeploy'),
    path('server/pool/', ServerPoolStatusView.as_view(), name='server-pool'),
    path('server/pairing/approve/', ApprovePairingView.as_view(), name='server-pairing-approve'),
]
