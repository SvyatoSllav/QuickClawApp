from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/profile/', include('apps.accounts.profile_urls')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/telegram/', include('apps.telegram_app.urls')),
    path('api/subscription/', include('apps.payments.subscription_urls')),
    path('api/', include('apps.servers.urls')),
    # SEO
    path('', include('apps.seo.urls')),
]
