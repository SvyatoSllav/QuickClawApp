import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { colors } from '../../config/colors';

export default function PlanCard() {
  const { t } = useTranslation();

  const features = [
    t('planFeature1'),
    t('planFeature2'),
    t('planFeature3'),
    t('planFeature4'),
  ];

  return (
    <Card>
      <CardHeader>
        <Text style={{ fontSize: 11, fontWeight: '600', color: '#8B8B8B', letterSpacing: 1.5, textTransform: 'uppercase' }}>
          PLAN
        </Text>
        <Text className="text-xl font-bold" style={{ color: colors.foreground }}>{t('planName')}</Text>
        <View className="flex-row items-baseline">
          <Text className="text-5xl font-black" style={{ letterSpacing: -2, color: colors.foreground }}>
            {t('planPrice')}
          </Text>
          <Text style={{ fontSize: 18, marginLeft: 4, color: '#8B8B8B' }}>{t('planPeriod')}</Text>
        </View>
      </CardHeader>
      <CardContent className="gap-3">
        <Separator />
        {features.map((feature, i) => (
          <View key={i} className="flex-row items-start gap-3">
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
              {String(i + 1).padStart(2, '0')}
            </Text>
            <Text variant="muted" className="text-base flex-1">{feature}</Text>
          </View>
        ))}
      </CardContent>
    </Card>
  );
}
