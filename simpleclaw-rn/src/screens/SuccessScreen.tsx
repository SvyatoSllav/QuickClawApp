import React, { useEffect } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import HeaderBar from '../components/HeaderBar';
import SpinnerIcon from '../components/ui/SpinnerIcon';
import DeployProgress from './success/DeployProgress';
import PairingInfo from './success/PairingInfo';
import { useDeployStore } from '../stores/deployStore';
import { useNavigationStore } from '../stores/navigationStore';
import { colors } from '../config/colors';

export default function SuccessScreen() {
  const { t } = useTranslation();
  const deploy = useDeployStore();
  const setScreen = useNavigationStore((s) => s.setScreen);

  useEffect(() => {
    deploy.startPolling();
    return () => deploy.stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView>
      <View style={{ maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <HeaderBar />
        <View className="px-4 pt-16 pb-10 items-center">
          {/* Status icon */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: deploy.isReady
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(59, 130, 246, 0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {deploy.isReady ? (
              <Text style={{ fontSize: 48, color: colors.emerald400 }}>✓</Text>
            ) : (
              <SpinnerIcon size={40} color={colors.blue400} />
            )}
          </View>

          <View className="h-6" />
          <Text className="text-white text-3xl font-bold text-center">
            {deploy.isReady ? t('botReady') : t('serverSetup')}
          </Text>
          <View className="h-2" />
          <Text className="text-zinc-300 text-base text-center">
            {deploy.isReady ? t('botReadyDesc') : t('paymentSuccess')}
          </Text>
          <View className="h-6" />

          <View style={{ maxWidth: 350, width: '100%' }}>
            <DeployProgress
              assigned={deploy.assigned}
              openclawRunning={deploy.openclawRunning}
            />
          </View>

          {deploy.isReady && (
            <View className="items-center mt-4">
              <Text className="text-emerald-400 text-base font-medium">
                {t('writeBotTelegram')}
              </Text>
              <View className="h-4" />
              <Pressable
                onPress={() => setScreen('profile')}
                className="bg-zinc-800 px-6 py-3.5 rounded-xl"
              >
                <Text className="text-white text-base font-medium">
                  {t('openProfile')}
                </Text>
              </Pressable>
              <View className="h-6" />
              <PairingInfo />
            </View>
          )}

          {deploy.status === 'error' && (
            <View className="mt-4 p-4 rounded-xl border" style={{ backgroundColor: 'rgba(248, 113, 113, 0.1)', borderColor: 'rgba(248, 113, 113, 0.3)' }}>
              <Text className="text-red-400 text-sm">{t('deployError')}</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
