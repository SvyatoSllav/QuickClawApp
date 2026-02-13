import logging
import json
import base64
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from .models import UserProfile
from .serializers import UserSerializer, ProfileUpdateSerializer

logger = logging.getLogger(__name__)


def decode_google_jwt(token):
    """Decode Google JWT token without verification (frontend already verified)"""
    try:
        # JWT format: header.payload.signature
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        # Decode payload (add padding if needed)
        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding
        
        decoded = base64.urlsafe_b64decode(payload)
        data = json.loads(decoded)
        
        return {
            'email': data.get('email', ''),
            'name': data.get('name', ''),
            'google_id': data.get('sub', ''),
            'avatar_url': data.get('picture', ''),
        }
    except Exception as e:
        logger.error(f'JWT decode failed: {e}')
        return None


def decode_apple_jwt(token):
    """Decode Apple identity token JWT payload (same approach as Google)"""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None

        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding

        decoded = base64.urlsafe_b64decode(payload)
        data = json.loads(decoded)

        return {
            'email': data.get('email', ''),
            'apple_id': data.get('sub', ''),
        }
    except Exception as e:
        logger.error(f'Apple JWT decode failed: {e}')
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

        token_data = decode_apple_jwt(token)
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
        email = request.data.get('email', '')
        name = request.data.get('name', '')
        google_id = request.data.get('google_id', '')
        avatar_url = request.data.get('avatar_url', '')

        # If only token provided, decode it to get user info
        if token and not email:
            token_data = decode_google_jwt(token)
            if token_data and token_data.get('email'):
                email = token_data['email']
                name = token_data.get('name', name)
                google_id = token_data.get('google_id', google_id)
                avatar_url = token_data.get('avatar_url', avatar_url)
                logger.info(f'Decoded Google token for: {email}')
            else:
                return Response({'error': 'Invalid Google token'}, status=400)

        if not email:
            return Response({'error': 'Email required'}, status=400)

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
