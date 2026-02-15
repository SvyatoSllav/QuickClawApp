import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { getServerPool } from '../../api/serverApi';

export default function LoginSection() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const signIn = useAuthStore((s) => s.signIn);
  const signInApple = useAuthStore((s) => s.signInApple);
  const [availableServers, setAvailableServers] = useState(5);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    getServerPool()
      .then((pool) => setAvailableServers(pool.available))
      .catch(() => {});

    if (Platform.OS === 'ios') {
      import('../../services/appleAuth').then(({ isAppleSignInAvailable }) =>
        isAppleSignInAvailable().then(setAppleAvailable),
      );
    }
  }, []);

  if (isAuthenticated) {
    return (
      <View className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-xl flex-row items-center">
        <Text className="text-blue-400 text-2xl mr-3">✉️</Text>
        <Text className="flex-1 text-sm">
          <Text className="text-zinc-300">{t('authPromptPart1')}</Text>
          <Text className="text-blue-400 font-medium">Telegram</Text>
          <Text className="text-zinc-300">{t('authPromptPart2')}</Text>
        </Text>
      </View>
    );
  }

  const isDisabled = loading || availableServers === 0;

  return (
    <View>
      <Pressable
        onPress={isDisabled ? undefined : signIn}
        className={`w-full py-3 rounded-xl items-center flex-row justify-center ${
          isDisabled ? 'bg-white/50' : 'bg-white'
        }`}
      >
        <Text className="text-black font-medium text-base">
          {loading ? t('loginLoading') : t('loginButton')}
        </Text>
      </Pressable>

      {appleAvailable && (
        <Pressable
          onPress={isDisabled ? undefined : signInApple}
          className="w-full py-3 rounded-xl items-center flex-row justify-center mt-3 border border-white"
          style={{ backgroundColor: isDisabled ? 'rgba(0,0,0,0.5)' : '#000000' }}
        >
          <Text className="text-white font-medium text-base">
            {loading ? t('loginLoading') : t('loginAppleButton')}
          </Text>
        </Pressable>
      )}

      {error && (
        <Text className="text-red-400 text-sm mt-2">{error}</Text>
      )}

      <View className="h-2" />

      {availableServers <= 0 ? (
        <Text className="text-red-400 text-sm font-medium">
          {t('noServers')}
        </Text>
      ) : (
        <Text className="text-sm">
          <Text style={{ color: '#6A6B6C' }}>{t('loginPrompt')} </Text>
          <Text className="text-indigo-400 font-medium">
            {t('serversLimited')} {availableServers}
          </Text>
        </Text>
      )}
    </View>
  );
}
