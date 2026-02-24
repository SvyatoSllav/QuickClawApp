import json
import logging
import uuid

import requests as http_requests
from django.conf import settings
from django.http import HttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import OAuthPendingFlow, Server
from .services import ServerManager

logger = logging.getLogger(__name__)

# Well-known provider URLs
WELL_KNOWN_PROVIDERS = {
    'google': {
        'authorization_url': 'https://accounts.google.com/o/oauth2/v2/auth',
        'token_url': 'https://oauth2.googleapis.com/token',
        'default_scopes': [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/gmail.readonly',
        ],
    },
    'github': {
        'authorization_url': 'https://github.com/login/oauth/authorize',
        'token_url': 'https://github.com/login/oauth/access_token',
        'default_scopes': ['repo', 'read:user'],
    },
}

REDIRECT_URI = 'https://claw-paw.com/auth/callback'


class OAuthStartView(APIView):
    """POST /api/oauth/start/ — initiate OAuth flow for user's server."""

    def post(self, request):
        provider = request.data.get('provider', '').strip()
        skill_key = request.data.get('skillKey', '').strip()
        scopes = request.data.get('scopes', [])

        if not provider or not skill_key:
            return Response({'error': 'provider and skillKey are required'}, status=400)

        well_known = WELL_KNOWN_PROVIDERS.get(provider)
        if not well_known:
            return Response({'error': f'Unknown provider: {provider}'}, status=400)

        profile = request.user.profile
        server = getattr(profile, 'server', None)
        if not server or not server.openclaw_running:
            return Response({'error': 'Server not ready'}, status=404)

        return _create_oauth_flow(server, provider, skill_key, scopes, well_known)


class OAuthStartByGatewayView(APIView):
    """POST /api/oauth/start-gw/ — initiate OAuth using gateway token (for agents on VPS)."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        gateway_token = request.data.get('gatewayToken', '').strip()
        provider = request.data.get('provider', '').strip()
        skill_key = request.data.get('skillKey', '').strip()
        scopes = request.data.get('scopes', [])

        if not gateway_token or not provider or not skill_key:
            return Response({'error': 'gatewayToken, provider, and skillKey are required'}, status=400)

        well_known = WELL_KNOWN_PROVIDERS.get(provider)
        if not well_known:
            return Response({'error': f'Unknown provider: {provider}'}, status=400)

        # Find server by gateway token
        try:
            server = Server.objects.get(gateway_token=gateway_token, status='active')
        except Server.DoesNotExist:
            return Response({'error': 'Invalid gateway token'}, status=403)

        return _create_oauth_flow(server, provider, skill_key, scopes, well_known)


def _create_oauth_flow(server, provider, skill_key, scopes, well_known):
    """Shared logic for creating an OAuth flow and returning authUrl."""
    from urllib.parse import urlencode

    client_id = getattr(settings, f'{provider.upper()}_CLIENT_ID', '') or getattr(settings, 'GOOGLE_CLIENT_ID', '')
    if not client_id:
        return Response({'error': f'No client_id configured for {provider}'}, status=500)

    resolved_scopes = scopes if scopes else well_known['default_scopes']
    state = uuid.uuid4().hex

    # Cleanup old flows
    old_ids = list(
        OAuthPendingFlow.objects.filter(server=server)
        .order_by('-created_at')[10:]
        .values_list('id', flat=True)
    )
    if old_ids:
        OAuthPendingFlow.objects.filter(id__in=old_ids).delete()

    OAuthPendingFlow.objects.create(
        state=state,
        server=server,
        provider=provider,
        skill_key=skill_key,
        scopes=' '.join(resolved_scopes),
    )

    params = {
        'response_type': 'code',
        'client_id': client_id,
        'redirect_uri': REDIRECT_URI,
        'scope': ' '.join(resolved_scopes),
        'state': state,
        'access_type': 'offline',
        'prompt': 'consent',
    }
    auth_url = f"{well_known['authorization_url']}?{urlencode(params)}"
    return Response({'authUrl': auth_url, 'state': state})


class OAuthCallbackView(APIView):
    """GET /auth/callback — Google/GitHub redirects here after user authorizes."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        code = request.query_params.get('code', '')
        state = request.query_params.get('state', '')
        error = request.query_params.get('error', '')

        if error:
            return HttpResponse(render_page('Error', f'Authorization denied: {error}'), content_type='text/html')

        if not code or not state:
            return HttpResponse(render_page('Error', 'Missing code or state parameter.'), content_type='text/html')

        # Find pending flow
        try:
            flow = OAuthPendingFlow.objects.select_related('server').get(state=state)
        except OAuthPendingFlow.DoesNotExist:
            return HttpResponse(render_page('Error', 'Invalid or expired state. Please try again.'), content_type='text/html')

        # Check flow age (5 minutes)
        from django.utils import timezone
        import datetime
        if timezone.now() - flow.created_at > datetime.timedelta(minutes=5):
            flow.delete()
            return HttpResponse(render_page('Error', 'Authorization expired. Please try again.'), content_type='text/html')

        provider = flow.provider
        well_known = WELL_KNOWN_PROVIDERS.get(provider)
        if not well_known:
            flow.delete()
            return HttpResponse(render_page('Error', f'Unknown provider: {provider}'), content_type='text/html')

        # Get client credentials
        client_id = getattr(settings, f'{provider.upper()}_CLIENT_ID', '') or getattr(settings, 'GOOGLE_CLIENT_ID', '')
        client_secret = getattr(settings, f'{provider.upper()}_CLIENT_SECRET', '') or getattr(settings, 'GOOGLE_CLIENT_SECRET', '')

        if not client_id or not client_secret:
            flow.delete()
            return HttpResponse(render_page('Error', 'OAuth credentials not configured on backend.'), content_type='text/html')

        # Exchange code for tokens
        try:
            token_resp = http_requests.post(
                well_known['token_url'],
                data={
                    'grant_type': 'authorization_code',
                    'code': code,
                    'redirect_uri': REDIRECT_URI,
                    'client_id': client_id,
                    'client_secret': client_secret,
                },
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                timeout=15,
            )
            token_resp.raise_for_status()
            tokens = token_resp.json()
        except Exception as e:
            logger.exception('OAuth token exchange failed for state %s', state)
            flow.delete()
            return HttpResponse(render_page('Error', f'Token exchange failed: {e}'), content_type='text/html')

        # Push tokens to user's VPS via SSH
        server = flow.server
        skill_key = flow.skill_key

        token_data = {
            'access_token': tokens.get('access_token', ''),
            'refresh_token': tokens.get('refresh_token', ''),
            'expires_in': tokens.get('expires_in'),
            'token_type': tokens.get('token_type', 'Bearer'),
            'scope': tokens.get('scope', ''),
            'provider': provider,
            'obtained_at': timezone.now().isoformat(),
        }
        # Remove empty values
        token_data = {k: v for k, v in token_data.items() if v is not None and v != ''}

        try:
            _push_tokens_to_server(server, skill_key, token_data)
        except Exception as e:
            logger.exception('Failed to push tokens to server %s', server.ip_address)
            flow.delete()
            return HttpResponse(render_page('Error', f'Failed to store tokens on server: {e}'), content_type='text/html')

        flow.delete()

        return HttpResponse(
            render_page(
                'Authorization Complete',
                f'Successfully authorized <strong>{provider}</strong> for skill '
                f'<strong>{skill_key}</strong>. You can close this window.'
            ),
            content_type='text/html',
        )


def _push_tokens_to_server(server, skill_key, token_data):
    """SSH into user's VPS and write oauth tokens to openclaw.json."""
    manager = ServerManager(server)
    try:
        manager.connect()

        config_path = '/var/lib/docker/volumes/openclaw_config/_data/openclaw.json'

        # Read current config
        out, err, exit_code = manager.exec_command(f'cat {config_path}')
        if exit_code != 0:
            raise RuntimeError(f'Failed to read config: {err}')

        cfg = json.loads(out)

        # Write tokens into skills.entries[skillKey].config.oauthTokens
        skills = cfg.setdefault('skills', {})
        entries = skills.setdefault('entries', {})
        entry = entries.setdefault(skill_key, {})
        config = entry.setdefault('config', {})
        config['oauthTokens'] = token_data

        # Write back
        new_config_json = json.dumps(cfg, indent=2)
        # Use python3 to write atomically (avoid broken json from echo)
        escaped = new_config_json.replace("'", "'\\''")
        manager.exec_command(
            f"python3 -c \"import sys; open('{config_path}','w').write(sys.stdin.read())\" <<'EOFCFG'\n{new_config_json}\nEOFCFG"
        )

        logger.info('OAuth tokens pushed to %s for skill %s', server.ip_address, skill_key)
    finally:
        manager.disconnect()


def render_page(title, body):
    return f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>body{{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f5}}
.card{{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);max-width:400px;text-align:center}}
h1{{margin:0 0 1rem;font-size:1.25rem}}</style></head>
<body><div class="card"><h1>{title}</h1><p>{body}</p></div></body></html>'''
