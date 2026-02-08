from django.urls import path
from .views import RobotsTxtView, SitemapView

urlpatterns = [
    path('robots.txt', RobotsTxtView.as_view(), name='robots-txt'),
    path('sitemap.xml', SitemapView.as_view(), name='sitemap'),
]
