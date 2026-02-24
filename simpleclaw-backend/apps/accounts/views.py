import logging
import json
import base64
import time
import requests as http_requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from django.conf import settings
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from .models import UserProfile
from .serializers import UserSerializer, ProfileUpdateSerializer

logger = logging.getLogger(__name__)


def verify_google_token(token):
    """Verify Google ID token signature, audience, expiry, issuer."""
    try:
        payload = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
        # verify_oauth2_token checks: signature, exp, aud, iss
        if payload.get('iss') not in ('accounts.google.com', 'https://accounts.google.com'):
            return None
        return {
            'email': payload.get('email', ''),
            'name': payload.get('name', ''),
            'google_id': payload.get('sub', ''),
            'avatar_url': payload.get('picture', ''),
            'email_verified': payload.get('email_verified', False),
        }
    except Exception as e:
        logger.warning('Google token verification failed: %s', e)
        return None


def verify_google_access_token(access_token):
    """Verify Google access token by calling Google userinfo API server-side."""
    try:
        resp = http_requests.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=5,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if not data.get('email'):
            return None
        return {
            'email': data['email'],
            'name': data.get('name', ''),
            'google_id': data.get('id', ''),
            'avatar_url': data.get('picture', ''),
            'email_verified': data.get('verified_email', False),
        }
    except Exception as e:
        logger.warning('Google access token verification failed: %s', e)
        return None


def verify_apple_token(token):
    """Verify Apple identity token: structure, expiry, issuer (no signature - no Apple credentials)."""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        # Decode header to check structure
        header = json.loads(base64.urlsafe_b64decode(parts[0] + '=='))
        if header.get('alg') not in ('RS256', 'ES256'):
            return None
        # Decode payload
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + '=='))
        # Check issuer
        if payload.get('iss') != 'https://appleid.apple.com':
            return None
        # Check expiry
        if payload.get('exp', 0) < time.time():
            return None
        # Check audience (should be our app bundle ID if configured)
        apple_client_id = getattr(settings, 'APPLE_CLIENT_ID', '')
        if apple_client_id and payload.get('aud') != apple_client_id:
            return None
        return {
            'email': payload.get('email', ''),
            'apple_id': payload.get('sub', ''),
            'email_verified': payload.get('email_verified', 'true') == 'true',
        }
    except Exception as e:
        logger.warning('Apple token verification failed: %s', e)
        return None


@method_decorator(csrf_exempt, name='dispatch')
class AppleAuthView(APIView):
    """Apple OAuth authentication"""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_authenticators(self):
        return []

    def post(self, request):
        token = request.data.get('token', '')
        name = request.data.get('name', '')

        if not token:
            return Response({'error': 'Token required'}, status=400)

        token_data = verify_apple_token(token)
        if not token_data or not token_data.get('email'):
            return Response({'error': 'Invalid Apple token'}, status=400)

        email = token_data['email']
        apple_id = token_data.get('apple_id', '')

        user = User.objects.filter(email=email).first()
        created = False

        if not user:
            base_username = email.split('@')[0][:20]
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f'{base_username}_{counter}'
                counter += 1

            user = User.objects.create(
                email=email,
                username=username,
                first_name=name.split(' ')[0] if name else '',
                last_name=' '.join(name.split(' ')[1:]) if name else '',
            )
            created = True
            logger.info(f'Created new user via Apple: {email}')

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if apple_id:
            profile.apple_id = apple_id
        profile.auth_provider = 'apple'
        profile.last_oauth_verified_at = timezone.now()
        profile.save()

        auth_token, _ = Token.objects.get_or_create(user=user)

        return Response({
            'token': auth_token.key,
            'user': UserSerializer(user).data,
            'created': created,
        })


@method_decorator(csrf_exempt, name='dispatch')
class GoogleAuthView(APIView):
    """Google OAuth authentication"""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_authenticators(self):
        return []

    def post(self, request):
        token = request.data.get('token', '')
        access_token = request.data.get('access_token', '')

        user_data = None

        if token:
            # Mobile flow: ID token with cryptographic verification
            user_data = verify_google_token(token)
            if not user_data or not user_data.get('email'):
                return Response({'error': 'Invalid Google token'}, status=400)
        elif access_token:
            # Web flow: access token verified via Google userinfo API
            user_data = verify_google_access_token(access_token)
            if not user_data or not user_data.get('email'):
                return Response({'error': 'Invalid Google access token'}, status=400)
        else:
            return Response({'error': 'Token or access_token required'}, status=400)

        email = user_data['email']
        name = user_data.get('name', '')
        google_id = user_data.get('google_id', '')
        avatar_url = user_data.get('avatar_url', '')

        user = User.objects.filter(email=email).first()
        created = False

        if not user:
            base_username = email.split('@')[0][:20]
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f'{base_username}_{counter}'
                counter += 1

            user = User.objects.create(
                email=email,
                username=username,
                first_name=name.split(' ')[0] if name else '',
                last_name=' '.join(name.split(' ')[1:]) if name else '',
            )
            created = True
            logger.info(f'Created new user: {email}')

        profile, _ = UserProfile.objects.get_or_create(user=user)
        if google_id:
            profile.google_id = google_id
        if avatar_url:
            profile.avatar_url = avatar_url
        profile.auth_provider = 'google'
        profile.last_oauth_verified_at = timezone.now()
        profile.save()

        auth_token, _ = Token.objects.get_or_create(user=user)

        return Response({
            'token': auth_token.key,
            'user': UserSerializer(user).data,
            'created': created,
        })


class LogoutView(APIView):
    def post(self, request):
        if hasattr(request.user, 'auth_token'):
            request.user.auth_token.delete()
        return Response({'status': 'ok'})


class CurrentUserView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ProfileView(APIView):
    def get(self, request):
        user = request.user
        profile = user.profile
        server = getattr(profile, 'server', None)

        data = UserSerializer(user).data

        if server:
            data['server'] = {
                'ip_address': server.ip_address,
                'status': server.status,
                'openclaw_running': server.openclaw_running,
            }
        else:
            data['server'] = None

        return Response(data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        profile = request.user.profile
        changed = False
        if 'selected_model' in serializer.validated_data:
            profile.selected_model = serializer.validated_data['selected_model']
            changed = True
        if 'clawdmatrix_enabled' in serializer.validated_data:
            profile.clawdmatrix_enabled = serializer.validated_data['clawdmatrix_enabled']
            changed = True
        if changed:
            profile.save()

        return Response(UserSerializer(request.user).data)


class ProfileUsageView(APIView):
    def get(self, request):
        profile = request.user.profile

        # Always return stored values immediately
        limit = float(profile.token_limit_usd)
        used = float(profile.tokens_used_usd)
        remaining = limit - used

        # Try quick async update if key exists
        if profile.openrouter_api_key:
            import threading
            def update_usage():
                import requests as req
                try:
                    resp = req.get(
                        'https://openrouter.ai/api/v1/key',
                        headers={'Authorization': f'Bearer {profile.openrouter_api_key}'},
                        timeout=3,
                    )
                    if resp.status_code == 200:
                        data = resp.json().get('data', {})
                        new_limit = data.get('limit', limit)
                        new_remaining = data.get('limit_remaining', new_limit)
                        new_used = new_limit - new_remaining
                        profile.tokens_used_usd = new_used
                        profile.token_limit_usd = new_limit
                        profile.save(update_fields=['tokens_used_usd', 'token_limit_usd'])
                except Exception:
                    pass
            threading.Thread(target=update_usage, daemon=True).start()

        return Response({
            'used': round(used, 4),
            'limit': limit,
            'remaining': round(remaining, 4),
        })

class PaymentHistoryView(APIView):
    def get(self, request):
        from apps.payments.models import Payment
        from apps.payments.serializers import PaymentSerializer

        payments = Payment.objects.filter(user=request.user).order_by('-created_at')[:20]
        return Response(PaymentSerializer(payments, many=True).data)
