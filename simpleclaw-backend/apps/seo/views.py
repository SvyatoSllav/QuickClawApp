from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.conf import settings


class RobotsTxtView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        content = (
            'User-agent: *\n'
            'Allow: /\n'
            f'Sitemap: {settings.FRONTEND_URL}/sitemap.xml\n'
        )
        return HttpResponse(content, content_type='text/plain')


class SitemapView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        base_url = settings.FRONTEND_URL
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f'  <url><loc>{base_url}/</loc><priority>1.0</priority></url>\n'
            '</urlset>\n'
        )
        return HttpResponse(xml, content_type='application/xml')
