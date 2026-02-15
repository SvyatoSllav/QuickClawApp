import React, { useCallback, useRef, useMemo } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { isValidTelegramToken } from '../utils/validators';
import { useTelegramStore } from '../stores/telegramStore';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../config/colors';

interface TelegramModalProps {
  onDismiss: () => void;
}

export default function TelegramModal({ onDismiss }: TelegramModalProps) {
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['85%', '95%'], []);

  const pendingToken = useTelegramStore((s) => s.pendingToken);
  const setToken = useTelegramStore((s) => s.setToken);
  const savePendingToken = useTelegramStore((s) => s.savePendingToken);
  const loading = useAuthStore((s) => s.loading);
  const signIn = useAuthStore((s) => s.signIn);

  const isValid = isValidTelegramToken(pendingToken);
  const showError = pendingToken.length > 0 && !isValid;

  const handleSave = useCallback(async () => {
    await savePendingToken();
    bottomSheetRef.current?.close();
    onDismiss();
    signIn();
  }, [savePendingToken, onDismiss, signIn]);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onDismiss}
      backgroundStyle={{ backgroundColor: colors.modalBg }}
      handleIndicatorStyle={{ backgroundColor: colors.zinc700 }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 24, paddingBottom: 32 }}>
        {/* Header */}
        <View className="flex-row items-center mb-5">
          <Text className="text-3xl mr-3">📱</Text>
          <Text className="text-white text-xl font-semibold">
            {t('connectTelegram')}
          </Text>
        </View>

        {/* Instructions */}
        <Text className="text-zinc-400 text-sm mb-3">{t('howToGetToken')}</Text>

        <Step number="1">
          <Text className="text-zinc-300 text-sm">
            {t('tgStep1Open')}
            <Text className="text-blue-400" onPress={() => Linking.openURL('https://t.me/BotFather')}>
              {t('tgStep1BotFather')}
            </Text>
            {t('tgStep1InTelegram')}
          </Text>
        </Step>
        <Step number="2">
          <Text className="text-zinc-300 text-sm">
            {t('tgStep2Send')}
            <Text className="text-zinc-300 bg-zinc-800">/newbot</Text>
          </Text>
        </Step>
        <Step number="3">
          <Text className="text-zinc-300 text-sm">{t('tgStep3')}</Text>
        </Step>
        <Step number="4">
          <Text className="text-zinc-300 text-sm">{t('tgStep4')}</Text>
        </Step>
        <Step number="5">
          <Text className="text-zinc-300 text-sm">{t('tgStep5')}</Text>
        </Step>

        {/* Token input */}
        <View className="mt-5">
          <Text className="text-zinc-400 text-sm mb-2">{t('tokenLabel')}</Text>
          <TextInput
            value={pendingToken}
            onChangeText={setToken}
            placeholder={t('tokenPlaceholder')}
            placeholderTextColor={colors.zinc500}
            style={{
              backgroundColor: colors.zinc800,
              color: '#FFFFFF',
              fontSize: 14,
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: showError ? colors.red400 : colors.zinc700,
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {showError && (
            <Text className="text-red-400 text-sm mt-2">{t('tokenError')}</Text>
          )}
        </View>

        {/* Save button */}
        <Pressable
          onPress={(loading || !isValid) ? undefined : handleSave}
          className="mt-4 w-full py-3.5 rounded-xl items-center"
          style={{
            backgroundColor: (loading || !isValid)
              ? 'rgba(37, 99, 235, 0.5)'
              : colors.blue600,
          }}
        >
          <Text className="text-white font-medium text-sm">
            {loading ? t('saving') : t('saveAndConnect')}
          </Text>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

function Step({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <View className="flex-row py-1">
      <Text className="text-white text-sm font-medium mr-1">{number}. </Text>
      <View className="flex-1">{children}</View>
    </View>
  );
}
