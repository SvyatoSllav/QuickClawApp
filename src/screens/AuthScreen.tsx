import React from 'react';
import { View, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '../stores/authStore';

export default function AuthScreen() {
  const { t } = useTranslation();
  const signInApple = useAuthStore((s) => s.signInApple);
  const signInGoogle = useAuthStore((s) => s.signInGoogle);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);

  return (
    <View className="flex-1 bg-background items-center justify-center px-6">
      <Text variant="h3" className="text-center mb-2">
        {t('signInTitle')}
      </Text>
      <Text variant="muted" className="text-center mb-10">
        {t('signInSubtitle')}
      </Text>

      <View className="w-full gap-3">
        {Platform.OS === 'ios' && (
          <Button onPress={signInApple} disabled={loading} className="w-full">
            <Text>{loading ? t('signingIn') : t('signInWithApple')}</Text>
          </Button>
        )}

        <Button variant="outline" onPress={signInGoogle} disabled={loading} className="w-full">
          <Text>{loading ? t('signingIn') : t('signInWithGoogle')}</Text>
        </Button>
      </View>

      {error && (
        <Text className="text-destructive text-sm mt-4 text-center">{error}</Text>
      )}
    </View>
  );
}
