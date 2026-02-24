from django.urls import path
from .views import (
    ServerStatusView, RedeployView, ServerPoolStatusView, ApprovePairingView,
    SetModelView, SkillsSearchView, SkillDetailView, SkillInstallView,
    SkillUninstallView, InternalWsAuthView,
)

# api/
urlpatterns = [
    path('server/status/', ServerStatusView.as_view(), name='server-status'),
    path('server/redeploy/', RedeployView.as_view(), name='server-redeploy'),
    path('server/pool/', ServerPoolStatusView.as_view(), name='server-pool'),
    path('server/pairing/approve/', ApprovePairingView.as_view(), name='server-pairing-approve'),
    path('server/set-model/', SetModelView.as_view(), name='server-set-model'),
    path('server/skills/install/', SkillInstallView.as_view(), name='skill-install'),
    path('server/skills/uninstall/', SkillUninstallView.as_view(), name='skill-uninstall'),
    path('skills/search/', SkillsSearchView.as_view(), name='skills-search'),
    path('skills/<slug:slug>/', SkillDetailView.as_view(), name='skill-detail'),
    path('internal/ws-auth/', InternalWsAuthView.as_view(), name='internal-ws-auth'),
]
