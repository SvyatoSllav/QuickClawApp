import React from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useNavigationStore } from '../stores/navigationStore';
import PlanCard from '../components/ui/PlanCard';
import { colors } from '../config/colors';

export default function PlanScreen() {
  const { t } = useTranslation();
  const purchasePackage = useSubscriptionStore((s) => s.purchasePackage);
  const restorePurchases = useSubscriptionStore((s) => s.restorePurchases);
  const loading = useSubscriptionStore((s) => s.loading);
  const error = useSubscriptionStore((s) => s.error);
  const setScreen = useNavigationStore((s) => s.setScreen);

  const handleContinue = async () => {
    const success = await purchasePackage();
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32 }} style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#8B8B8B', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 24 }}>
          ACCESS
        </Text>

        <Text variant="h3" className="mb-8" style={{ color: colors.foreground }}>
          {t('planTitle')}
        </Text>

        <PlanCard />

        {error && (
          <Text className="text-destructive text-sm text-center mt-4">{error}</Text>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 32, gap: 12 }}>
        <Button
          onPress={handleContinue}
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

        <Button variant="ghost" onPress={handleRestore} disabled={loading}>
          <Text className="text-xs font-medium uppercase" style={{ letterSpacing: 2, color: colors.foreground }}>
            {t('restorePurchases')}
          </Text>
        </Button>
      </View>
    </View>
  );
}
