import os
from pathlib import Path
import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

SECRET_KEY = env('SECRET_KEY')
DEBUG = env.bool('DEBUG', default=False)
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['*'])

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Сторонние
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'django_celery_beat',
    # Приложения
    'apps.accounts',
    'apps.payments',
    'apps.servers',
    'apps.telegram_app',
    'apps.telegram_bot',
    'apps.seo',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': env.db('DATABASE_URL'),
}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'Europe/Moscow'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# CORS
CORS_ALLOWED_ORIGINS = [
    'https://install-openclow.ru',
    'http://localhost:5173',
    'http://localhost:8090',
    'tauri://localhost',
    'https://tauri.localhost',
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    'https://install-openclow.ru',
]

# Redis cache (used for SkillsMP proxy etc.)
REDIS_URL = env('REDIS_URL', default='redis://localhost:6379/0')
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_URL,
    }
}

# SkillsMP API
SKILLSMP_API_KEY = env('SKILLSMP_API_KEY', default='sk_live_skillsmp_nk85O6aCBjU1C39hvaiEO46okUqpPyECIgWn5TKK99o')
SKILLSMP_BASE_URL = 'https://skillsmp.com/api/v1'

# Celery
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Europe/Moscow'
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'process-subscription-renewals': {
        'task': 'apps.payments.tasks.process_subscription_renewals',
        'schedule': crontab(hour=3, minute=0),  # Daily at 03:00 MSK
    },
    'cleanup-error-servers': {
        'task': 'apps.servers.tasks.cleanup_error_servers',
        'schedule': crontab(minute='*/10'),  # Every 10 minutes
    },
    'ensure-server-pool': {
        'task': 'apps.servers.tasks.ensure_server_pool',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
    },
    'monitor-servers': {
        'task': 'apps.servers.tasks.monitor_servers',
        'schedule': crontab(minute='*/10'),  # Every 10 minutes
    },
    'reset-openrouter-keys-monthly': {
        'task': 'apps.servers.tasks.reset_openrouter_keys_monthly',
        'schedule': crontab(day_of_month=1, hour=2, minute=0),  # 1st of each month at 02:00
    },
}

# Google OAuth
GOOGLE_CLIENT_ID = env('GOOGLE_CLIENT_ID', default='')
GOOGLE_CLIENT_SECRET = env('GOOGLE_CLIENT_SECRET', default='')

# YooKassa
YOOKASSA_SHOP_ID = env('YOOKASSA_SHOP_ID', default='')
YOOKASSA_SECRET_KEY = env('YOOKASSA_SECRET_KEY', default='')
SUBSCRIPTION_PRICE_RUB = env.int('SUBSCRIPTION_PRICE_RUB', default=990)

# RevenueCat
REVENUECAT_WEBHOOK_AUTH_KEY = env('REVENUECAT_WEBHOOK_AUTH_KEY', default='')

# OpenRouter
OPENROUTER_ADMIN_KEY = env('OPENROUTER_ADMIN_KEY', default='')
OPENROUTER_TOKEN_LIMIT = env.float('OPENROUTER_TOKEN_LIMIT', default=15.00)

# Telegram Admin
ADMIN_TELEGRAM_BOT_TOKEN = env('ADMIN_TELEGRAM_BOT_TOKEN', default='')
ADMIN_TELEGRAM_CHAT_ID = env('ADMIN_TELEGRAM_CHAT_ID', default='')

# Frontend
FRONTEND_URL = env('FRONTEND_URL', default='https://install-openclow.ru')

# Default model for new deployments
DEFAULT_MODEL = 'claude-sonnet-4'

# Маппинг моделей → OpenRouter slugs
MODEL_MAPPING = {
    'claude-sonnet-4': 'anthropic/claude-sonnet-4',
    'claude-opus-4.5': 'anthropic/claude-opus-4.5',
    'claude-sonnet-4.5': 'anthropic/claude-sonnet-4-5-20250929',
    'claude-haiku-4.5': 'anthropic/claude-haiku-4.5',
    'gpt-4o': 'openai/gpt-4o',
    'gemini-3-flash': 'google/gemini-3-flash-preview',
    'gemini-2.5-flash': 'google/gemini-2.5-flash',
    'minimax-m2.5': 'minimax/minimax-m2.5',
}

# SimpleClaw Sales Bot
SIMPLECLAW_BOT_TOKEN = env('SIMPLECLAW_BOT_TOKEN', default='')
YOOKASSA_TEST_SHOP_ID = env('YOOKASSA_TEST_SHOP_ID', default='')
YOOKASSA_TEST_SECRET_KEY = env('YOOKASSA_TEST_SECRET_KEY', default='')

# TimeWeb Cloud
TIMEWEB_API_TOKEN = env('TIMEWEB_API_TOKEN', default='')
