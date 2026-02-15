import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function PairingInfo() {
  const { t } = useTranslation();

  return (
    <View
      className="p-4 rounded-xl border border-zinc-700/50"
      style={{ backgroundColor: 'rgba(24, 24, 27, 0.6)' }}
    >
      <Text className="text-zinc-300 text-sm leading-5">
        {t('pairingIntro')}
      </Text>
      <View className="h-2" />
      <View className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(39, 39, 42, 0.8)' }}>
        <Text className="text-zinc-400 text-xs leading-5" style={{ fontFamily: 'monospace' }}>
          {t('pairingCode')}
        </Text>
      </View>
      <View className="h-2" />
      <Text className="text-zinc-300 text-sm leading-5">
        {t('pairingExplanation')}
      </Text>
    </View>
  );
}
