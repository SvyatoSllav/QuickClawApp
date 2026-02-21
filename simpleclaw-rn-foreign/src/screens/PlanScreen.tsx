import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useNavigationStore } from '../stores/navigationStore';
import { colors } from '../config/colors';

export default function PlanScreen() {
  const { t } = useTranslation();
  const presentPaywall = useSubscriptionStore((s) => s.presentPaywall);
  const restorePurchases = useSubscriptionStore((s) => s.restorePurchases);
  const loading = useSubscriptionStore((s) => s.loading);
  const error = useSubscriptionStore((s) => s.error);
  const setScreen = useNavigationStore((s) => s.setScreen);

  const handleSubscribe = async () => {
    const success = await presentPaywall();
    if (success) {
      setScreen('chat');
    }
  };

  const handleRestore = async () => {
    const success = await restorePurchases();
    if (success) {
      setScreen('chat');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', paddingHorizontal: 24 }}>
      <Text variant="h3" className="text-center mb-2" style={{ color: colors.foreground }}>
        {t('planTitle')}
      </Text>
      <Text variant="muted" className="text-center mb-10">
        {t('planSubtitle', 'Unlock full access to EasyClaw')}
      </Text>

      {error && (
        <Text className="text-sm text-center mb-4" style={{ color: colors.destructive }}>{error}</Text>
      )}

      <Button
        onPress={handleSubscribe}
        disabled={loading}
        className="w-full"
        style={{ backgroundColor: colors.primary }}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{t('continue')}</Text>
        )}
      </Button>

      <Button variant="ghost" onPress={handleRestore} disabled={loading} className="mt-3">
        <Text className="text-xs font-medium uppercase" style={{ letterSpacing: 2, color: colors.foreground }}>
          {t('restorePurchases')}
        </Text>
      </Button>
    </View>
  );
}
