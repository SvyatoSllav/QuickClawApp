import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '../stores/authStore';

export default function AuthScreen() {
  const { t } = useTranslation();
  const skipAuth = useAuthStore((s) => s.skipAuth);
  const loading = useAuthStore((s) => s.loading);

  return (
    <View className="flex-1 bg-background items-center justify-center px-6">
      <Text variant="h3" className="text-center mb-2">
        {t('signInTitle')}
      </Text>
      <Text variant="muted" className="text-center mb-10">
        {t('signInSubtitle')}
      </Text>

      <Button onPress={skipAuth} disabled={loading} className="w-full">
        <Text>{loading ? t('signingIn') : t('skip')}</Text>
      </Button>
    </View>
  );
}
