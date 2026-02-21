import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../config/colors';

export default function AuthScreen() {
  const { t } = useTranslation();
  const skipAuth = useAuthStore((s) => s.skipAuth);
  const loading = useAuthStore((s) => s.loading);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <Text variant="h3" className="text-center mb-2" style={{ color: colors.foreground }}>
        {t('signInTitle')}
      </Text>
      <Text variant="muted" className="text-center mb-10">
        {t('signInSubtitle')}
      </Text>

      <Button
        onPress={skipAuth}
        disabled={loading}
        className="w-full"
        style={{ backgroundColor: colors.primary }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{loading ? t('signingIn') : t('skip')}</Text>
      </Button>
    </View>
  );
}
