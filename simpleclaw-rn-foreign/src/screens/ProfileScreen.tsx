import React, { useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '../stores/authStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useUsageStore } from '../stores/usageStore';
import { cancelSubscription } from '../api/subscriptionApi';
import { formatDate } from '../utils/formatDate';
import IntegrationsCard from '../components/integrations/IntegrationsCard';
import TelegramSetupSheet from '../components/integrations/TelegramSetupSheet';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const subscription = useAuthStore((s) => s.subscription);
  const logout = useAuthStore((s) => s.logout);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const goBack = useNavigationStore((s) => s.goBack);
  const usage = useUsageStore();
  const [showTelegramSheet, setShowTelegramSheet] = useState(false);

  React.useEffect(() => {
    usage.loadUsage();
  }, []);

  const handleCancel = () => {
    Alert.alert(t('cancelSubscription'), t('cancelConfirm'), [
      { text: t('back'), style: 'cancel' },
      {
        text: t('cancelSubscription'),
        style: 'destructive',
        onPress: async () => {
          await cancelSubscription();
          await loadProfile();
        },
      },
    ]);
  };

  const usagePercent = usage.limit > 0 ? Math.min((usage.used / usage.limit) * 100, 100) : 0;

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Button variant="ghost" size="sm" onPress={goBack}>
          <Text className="text-sm font-medium">{t('back')}</Text>
        </Button>
        <Text className="font-bold text-lg ml-2">{t('profile')}</Text>
      </View>

      <ScrollView contentContainerClassName="px-6 pt-6 pb-12 gap-4">
        <Card>
          <CardHeader>
            <Text variant="muted" className="text-xs font-medium uppercase" style={{ letterSpacing: 1.5 }}>
              ACCOUNT
            </Text>
            <CardTitle className="text-xl">
              {user?.firstName} {user?.lastName}
            </CardTitle>
            <Text variant="muted">{user?.email}</Text>
          </CardHeader>
        </Card>

        {subscription?.isActive && (
          <Card>
            <CardHeader>
              <Text variant="muted" className="text-xs font-medium uppercase" style={{ letterSpacing: 1.5 }}>
                SUBSCRIPTION
              </Text>
            </CardHeader>
            <CardContent className="gap-4">
              <View className="flex-row justify-between">
                <Text variant="muted">{t('planName')}</Text>
                <Text className="text-primary font-bold text-sm uppercase">ACTIVE</Text>
              </View>
              {subscription.currentPeriodEnd && (
                <View className="flex-row justify-between">
                  <Text variant="muted">{t('validUntil')}</Text>
                  <Text className="font-medium text-sm">
                    {formatDate(subscription.currentPeriodEnd)}
                  </Text>
                </View>
              )}

              <Separator />

              <View>
                <View className="flex-row justify-between mb-2">
                  <Text variant="muted">{t('usage')}</Text>
                  <Text className="text-sm font-medium">
                    ${usage.used.toFixed(2)} {t('usageOf')} ${usage.limit.toFixed(2)}
                  </Text>
                </View>
                <Progress
                  value={usagePercent}
                  indicatorClassName={
                    usagePercent > 90
                      ? 'bg-destructive'
                      : usagePercent > 70
                        ? 'bg-yellow-500'
                        : undefined
                  }
                />
              </View>

              <Button variant="ghost" onPress={handleCancel} className="self-start">
                <Text className="text-destructive text-xs font-medium uppercase" style={{ letterSpacing: 1.5 }}>
                  {t('cancelSubscription')}
                </Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {!subscription?.isActive && (
          <Card>
            <CardContent>
              <Text variant="muted">{t('noSubscription')}</Text>
            </CardContent>
          </Card>
        )}

        <IntegrationsCard onTelegramPress={() => setShowTelegramSheet(true)} />

        <Button variant="outline" onPress={logout} className="w-full">
          <Text>{t('logout')}</Text>
        </Button>
      </ScrollView>

      <TelegramSetupSheet
        visible={showTelegramSheet}
        onClose={() => setShowTelegramSheet(false)}
      />
    </View>
  );
}
