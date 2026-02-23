import React, { useState } from 'react';
import { View, ScrollView, Alert, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '../stores/authStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useUsageStore } from '../stores/usageStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { cancelSubscription } from '../api/subscriptionApi';
import { formatDate } from '../utils/formatDate';
import IntegrationsCard from '../components/integrations/IntegrationsCard';
import TelegramSetupSheet from '../components/integrations/TelegramSetupSheet';
import { colors } from '../config/colors';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const subscription = useAuthStore((s) => s.subscription);
  const logout = useAuthStore((s) => s.logout);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const goBack = useNavigationStore((s) => s.goBack);
  const setScreen = useNavigationStore((s) => s.setScreen);
  const usage = useUsageStore();
  const presentCustomerCenter = useSubscriptionStore((s) => s.presentCustomerCenter);
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
    <View style={localStyles.container}>
      <View style={localStyles.header}>
        <Button variant="ghost" size="sm" onPress={goBack}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.foreground }}>{t('back')}</Text>
        </Button>
        <Text style={localStyles.headerTitle}>{t('profile')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48, gap: 16 }}>
        <Card>
          <CardHeader>
            <Text style={localStyles.sectionLabel}>ACCOUNT</Text>
            <CardTitle className="text-xl">
              {user?.firstName} {user?.lastName}
            </CardTitle>
            <Text variant="muted">{user?.email}</Text>
          </CardHeader>
        </Card>

        {subscription?.isActive && (
          <Card>
            <CardHeader>
              <Text style={localStyles.sectionLabel}>SUBSCRIPTION</Text>
            </CardHeader>
            <CardContent className="gap-4">
              <View className="flex-row justify-between">
                <Text variant="muted">{t('planName')}</Text>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14, textTransform: 'uppercase' }}>ACTIVE</Text>
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

              <View className="flex-row gap-3">
                <Button variant="outline" onPress={presentCustomerCenter} className="flex-1">
                  <Text className="text-xs font-medium uppercase" style={{ letterSpacing: 1.5, color: colors.foreground }}>
                    {t('manageSubscription', 'Manage')}
                  </Text>
                </Button>
                <Button variant="ghost" onPress={handleCancel} className="self-start">
                  <Text className="text-destructive text-xs font-medium uppercase" style={{ letterSpacing: 1.5 }}>
                    {t('cancelSubscription')}
                  </Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        )}

        {!subscription?.isActive && (
          <Card>
            <CardHeader>
              <Text style={localStyles.sectionLabel}>SUBSCRIPTION</Text>
            </CardHeader>
            <CardContent className="gap-4">
              <Text variant="muted">{t('noSubscription')}</Text>
              <Button
                onPress={() => setScreen('plan')}
                className="w-full"
                style={{ backgroundColor: colors.primary }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{t('upgradePlan', 'Upgrade Plan')}</Text>
              </Button>
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

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E0D4',
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 18,
    marginLeft: 8,
    color: '#1A1A1A',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B8B8B',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
