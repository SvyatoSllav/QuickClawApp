import React from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useNavigationStore } from '../stores/navigationStore';
import PlanCard from '../components/ui/PlanCard';

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
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-6 pt-16 pb-8" className="flex-1">
        <Text variant="muted" className="text-xs font-medium uppercase mb-6" style={{ letterSpacing: 2 }}>
          ACCESS
        </Text>

        <Text variant="h3" className="mb-8">
          {t('planTitle')}
        </Text>

        <PlanCard />

        {error && (
          <Text className="text-destructive text-sm text-center mt-4">{error}</Text>
        )}
      </ScrollView>

      <View className="px-6 pb-8 gap-3">
        <Button onPress={handleContinue} disabled={loading} className="w-full">
          {loading ? (
            <ActivityIndicator color="#171717" size="small" />
          ) : (
            <Text>{t('continue')}</Text>
          )}
        </Button>

        <Button variant="ghost" onPress={handleRestore} disabled={loading}>
          <Text className="text-xs font-medium uppercase" style={{ letterSpacing: 2 }}>
            {t('restorePurchases')}
          </Text>
        </Button>
      </View>
    </View>
  );
}
