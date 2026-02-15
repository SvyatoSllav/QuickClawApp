import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import GradientText from '../../components/ui/GradientText';

export default function ComparisonSection() {
  const { t } = useTranslation();

  const traditionalSteps = [
    { label: t('stepBuyServer'), time: 30 },
    { label: t('stepCreateSSH'), time: 10 },
    { label: t('stepConnectOS'), time: 20 },
    { label: t('stepInstallDocker'), time: 30 },
    { label: t('stepInstallOpenClaw'), time: 30 },
    { label: t('stepConfigureSettings'), time: 30 },
    { label: t('stepConnectTelegram'), time: 30 },
  ];

  return (
    <View className="px-4 py-12">
      {/* Divider with label */}
      <View className="flex-row items-center mb-6">
        <View className="flex-1 h-0.5 overflow-hidden">
          <LinearGradient colors={['transparent', '#581D27']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </View>
        <Text className="text-zinc-400 text-sm mx-4">{t('comparison')}</Text>
        <View className="flex-1 h-0.5 overflow-hidden">
          <LinearGradient colors={['#581D27', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </View>
      </View>

      <GradientText text={t('comparisonTitle')} fontSize={24} />
      <View className="h-8" />

      {/* Traditional side */}
      <View>
        <Text className="text-zinc-400 text-base font-medium italic">{t('traditional')}</Text>
        <View className="h-2" />
        {traditionalSteps.map((step) => (
          <View key={step.label} className="flex-row justify-between py-1">
            <Text className="text-zinc-400 text-sm flex-1">{step.label}</Text>
            <Text className="text-zinc-400 text-sm">{step.time} {t('minuteShort')}</Text>
          </View>
        ))}
        <View className="mt-3 pt-3 border-t-2 border-white/20 flex-row justify-between">
          <Text className="text-white text-base font-medium italic">{t('total')}</Text>
          <Text className="text-white text-base font-medium">{t('threeHours')}</Text>
        </View>
      </View>

      {/* Divider */}
      <View className="h-0.5 bg-white/10 my-6" />

      {/* SimpleClaw side */}
      <View>
        <Text className="text-zinc-400 text-base font-medium italic">SimpleClaw</Text>
        <View className="h-3" />
        <Text className="text-white text-3xl font-semibold">{t('lessThanOneMin')}</Text>
        <View className="h-2" />
        <View className="flex-row items-center">
          <Text className="text-emerald-400 text-xl font-semibold">{t('price')}</Text>
          <Text className="text-zinc-500 text-base line-through ml-2">{t('oldPrice')}</Text>
        </View>
        <View className="h-2" />
        <Text className="text-zinc-400 text-sm">{t('simpleclawDesc')}</Text>
        <View className="h-1" />
        <Text className="text-sm" style={{ color: 'rgba(52, 211, 153, 0.8)' }}>{t('apiCredits')}</Text>
      </View>
    </View>
  );
}
