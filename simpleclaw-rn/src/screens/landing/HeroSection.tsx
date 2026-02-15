import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import GradientText from '../../components/ui/GradientText';

export default function HeroSection() {
  const { t } = useTranslation();

  return (
    <View className="px-4 pt-8 pb-4">
      <GradientText text={t('heroTitle')} />
      <View className="h-3" />
      <Text className="text-zinc-400 text-sm text-center leading-5">
        {t('heroSubtitle')}
      </Text>
    </View>
  );
}
