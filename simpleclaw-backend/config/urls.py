from django.contrib import admin
from django.urls import path, include
from apps.servers.oauth_views import OAuthCallbackView, OAuthStartView, OAuthStartByGatewayView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/profile/', include('apps.accounts.profile_urls')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/telegram/', include('apps.telegram_app.urls')),
    path('api/subscription/', include('apps.payments.subscription_urls')),
    path('api/support/', include('apps.support.urls')),
    path('api/', include('apps.servers.urls')),
    path('api/', include('apps.servers.desktop_urls')),
    path('api/', include('apps.servers.mobile_urls')),
    # OAuth
    path('api/oauth/start/', OAuthStartView.as_view(), name='oauth-start'),
    path('api/oauth/start-gw/', OAuthStartByGatewayView.as_view(), name='oauth-start-gw'),
    path('auth/callback', OAuthCallbackView.as_view(), name='oauth-callback'),
    # SEO
    path('', include('apps.seo.urls')),
]
