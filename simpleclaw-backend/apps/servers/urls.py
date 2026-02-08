from django.urls import path
from .views import ServerStatusView, RedeployView, ServerPoolStatusView

# api/
urlpatterns = [
    path('server/status/', ServerStatusView.as_view(), name='server-status'),
    path('server/redeploy/', RedeployView.as_view(), name='server-redeploy'),
    path('server/pool/', ServerPoolStatusView.as_view(), name='server-pool'),
]
