import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import PulseDot from '../../components/ui/PulseDot';
import { colors } from '../../config/colors';

interface DeployProgressProps {
  assigned: boolean;
  openclawRunning: boolean;
  iconSize?: number;
  connectorHeight?: number;
}

export default function DeployProgress({
  assigned,
  openclawRunning,
  iconSize = 32,
  connectorHeight = 16,
}: DeployProgressProps) {
  const { t } = useTranslation();
  const deployReady = assigned && openclawRunning;

  const stepThreeLabel = deployReady
    ? t('openclawConfigured')
    : assigned
    ? t('openclawConfiguring')
    : t('openclawPending');

  return (
    <View>
      <StepRow done active={false} label={t('paymentDone')} iconSize={iconSize} />
      <Connector active={assigned} iconSize={iconSize} height={connectorHeight} />
      <StepRow
        done={assigned}
        active={!assigned}
        label={assigned ? t('serverAssigned') : t('serverAssigning')}
        iconSize={iconSize}
      />
      <Connector active={deployReady} iconSize={iconSize} height={connectorHeight} />
      <StepRow
        done={deployReady}
        active={assigned && !openclawRunning}
        label={stepThreeLabel}
        iconSize={iconSize}
      />
    </View>
  );
}

function StepRow({ done, active, label, iconSize }: { done: boolean; active: boolean; label: string; iconSize: number }) {
  const textColor = done ? colors.emerald400 : active ? colors.zinc400 : colors.zinc600;
  const dotSize = iconSize * 0.375;

  return (
    <View className="flex-row items-center py-3">
      <View
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize / 2,
          backgroundColor: done ? 'rgba(16, 185, 129, 0.2)' : colors.zinc800,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {done ? (
          <Text style={{ color: colors.emerald400, fontSize: iconSize * 0.5 }}>✓</Text>
        ) : active ? (
          <PulseDot size={dotSize} />
        ) : (
          <View
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: colors.zinc600,
            }}
          />
        )}
      </View>
      <Text
        className="ml-3 flex-1 text-sm font-medium"
        style={{ color: textColor }}
      >
        {label}
      </Text>
    </View>
  );
}

function Connector({ active, iconSize, height }: { active: boolean; iconSize: number; height: number }) {
  return (
    <View
      style={{
        marginLeft: iconSize / 2 - 0.5,
        width: 1,
        height,
        backgroundColor: active ? 'rgba(16, 185, 129, 0.4)' : colors.zinc700,
      }}
    />
  );
}
