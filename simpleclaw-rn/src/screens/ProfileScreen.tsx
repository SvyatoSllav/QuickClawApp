import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import HeaderBar from '../components/HeaderBar';
import SpinnerIcon from '../components/ui/SpinnerIcon';
import UsageProgressBar from '../components/ui/UsageProgressBar';
import DeployProgress from './success/DeployProgress';
import PairingInfo from './success/PairingInfo';
import { useAuthStore } from '../stores/authStore';
import { useDeployStore } from '../stores/deployStore';
import { useUsageStore } from '../stores/usageStore';
import { useNavigationStore } from '../stores/navigationStore';
import { cancelSubscription } from '../api/subscriptionApi';
import { formatDate } from '../utils/formatDate';
import { colors } from '../config/colors';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const authState = useAuthStore();
  const deploy = useDeployStore();
  const usage = useUsageStore();
  const setScreen = useNavigationStore((s) => s.setScreen);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const [cancelling, setCancelling] = useState(false);

  const subscription = authState.subscription;
  const profile = authState.profile;
  const hasActiveSub = subscription?.isActive ?? false;

  useEffect(() => {
    if (hasActiveSub) {
      usage.loadUsage();
      if (!deploy.isReady) {
        deploy.startPolling();
      }
    }
    return () => deploy.stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveSub]);

  const handleCancel = () => {
    Alert.alert(
      t('cancelSubscription'),
      t('cancelConfirm'),
      [
        { text: t('back'), style: 'cancel' },
        {
          text: t('cancelSubscription'),
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelSubscription();
              await loadProfile();
            } catch {
              Alert.alert(t('errorOccurred'));
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView>
      <View style={{ maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <HeaderBar />
        <View className="px-4 pt-12 pb-10">
          {/* Header */}
          <View className="flex-row justify-between items-center">
            <Text className="text-white text-3xl font-bold">{t('profile')}</Text>
            <Pressable onPress={() => setScreen('landing')}>
              <Text className="text-zinc-400 text-2xl">✕</Text>
            </Pressable>
          </View>
          <View className="h-6" />

          {/* User card */}
          <View className="p-6 rounded-2xl border border-zinc-800" style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)' }}>
            <View className="flex-row items-center">
              <View className="w-16 h-16 rounded-full bg-zinc-800 items-center justify-center">
                <Text className="text-zinc-500 text-3xl">👤</Text>
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-white text-base font-medium">{authState.user?.email ?? ''}</Text>
                <View className="h-1" />
                <Text className="text-zinc-500 text-sm">{profile?.selectedModel ?? 'gemini-3-flash'}</Text>
              </View>
            </View>
          </View>
          <View className="h-4" />

          {/* Deploy card */}
          {hasActiveSub && !deploy.isReady && (
            <>
              <View className="p-6 rounded-2xl border" style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
                <View className="flex-row items-center mb-3">
                  <SpinnerIcon size={20} color={colors.blue400} />
                  <Text className="text-white text-base font-semibold ml-2">{t('serverSetupTitle')}</Text>
                </View>
                <DeployProgress assigned={deploy.assigned} openclawRunning={deploy.openclawRunning} iconSize={24} connectorHeight={12} />
                {deploy.status === 'error' && (
                  <View className="mt-3 p-3 rounded-xl border" style={{ backgroundColor: 'rgba(248, 113, 113, 0.1)', borderColor: 'rgba(248, 113, 113, 0.3)' }}>
                    <Text className="text-red-400 text-sm">{t('errorOccurred')}</Text>
                  </View>
                )}
              </View>
              <View className="h-4" />
            </>
          )}

          {/* Subscription card */}
          <View className="p-6 rounded-2xl border border-zinc-800" style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)' }}>
            <Text className="text-white text-base font-semibold mb-4">{t('subscription')}</Text>
            {hasActiveSub ? (
              <>
                <InfoRow label={t('statusLabel')} value={t('active')} valueColor={colors.emerald400} />
                <View className="h-3" />
                <InfoRow label={t('validUntil')} value={formatDate(subscription!.currentPeriodEnd)} />
                <View className="h-4" />

                {/* Usage */}
                <View className="pt-4 border-t border-zinc-700/50">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-zinc-400 text-sm">{t('used')}</Text>
                    <Text className="text-white text-sm font-medium">
                      {usage.used.toFixed(4)} / {Math.floor(usage.limit)} $
                    </Text>
                  </View>
                  <UsageProgressBar used={usage.used} limit={usage.limit} />
                </View>
                <View className="h-4" />

                {profile?.cancellationScheduled ? (
                  <View className="p-3 rounded-xl border" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                    <Text className="text-amber-500 text-sm text-center">
                      {t('subscriptionEnding')} {formatDate(subscription!.currentPeriodEnd)}
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={cancelling ? undefined : handleCancel}
                    className="w-full py-3 rounded-xl items-center border"
                    style={{ backgroundColor: 'rgba(248, 113, 113, 0.1)', borderColor: 'rgba(248, 113, 113, 0.3)' }}
                  >
                    <Text className="text-red-400 text-sm">{t('cancelSubscription')}</Text>
                  </Pressable>
                )}
              </>
            ) : (
              <Text className="text-zinc-500 text-sm">{t('noSubscription')}</Text>
            )}
          </View>

          {/* Pairing info */}
          {hasActiveSub && deploy.isReady && (
            <>
              <View className="h-4" />
              <PairingInfo />
            </>
          )}

          {/* Back button */}
          <View className="h-6" />
          <Pressable
            onPress={() => setScreen('landing')}
            className="w-full py-3.5 rounded-xl items-center bg-zinc-800"
          >
            <Text className="text-white text-base font-medium">{t('back')}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value, valueColor = '#FFFFFF' }: { label: string; value: string; valueColor?: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-zinc-400 text-sm">{label}</Text>
      <Text className="text-sm font-medium" style={{ color: valueColor }}>{value}</Text>
    </View>
  );
}
