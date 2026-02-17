import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { useDeployStore } from '../../stores/deployStore';
import SpinnerIcon from '../ui/SpinnerIcon';
import PulseDot from '../ui/PulseDot';

export default function ConnectingOverlay() {
  const { t } = useTranslation();
  const startPolling = useDeployStore((s) => s.startPolling);
  const stopPolling = useDeployStore((s) => s.stopPolling);
  const assigned = useDeployStore((s) => s.assigned);
  const openclawRunning = useDeployStore((s) => s.openclawRunning);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  return (
    <View className="flex-1 items-center justify-center px-8">
      <SpinnerIcon size={48} />
      <Text variant="h4" className="mt-6 mb-2 uppercase" style={{ letterSpacing: 1.5 }}>
        {t('connecting')}
      </Text>
      <Text variant="muted" className="text-center text-base mb-8">
        {t('connectingDesc')}
      </Text>

      <View className="w-full gap-4">
        <StepRow label={t('serverAssigning')} done={assigned} active={!assigned} index="01" />
        <StepRow label={t('configuringAgent')} done={openclawRunning} active={assigned && !openclawRunning} index="02" />
        <StepRow label={t('agentReady')} done={false} active={openclawRunning} index="03" />
      </View>
    </View>
  );
}

function StepRow({ label, done, active, index }: { label: string; done: boolean; active: boolean; index: string }) {
  return (
    <View className="flex-row items-center gap-3 border-t border-border pt-3">
      <Text variant="muted" className="text-xs font-bold w-6" style={{ letterSpacing: 2 }}>
        {index}
      </Text>
      {done ? (
        <Text className="text-primary text-sm font-bold">DONE</Text>
      ) : active ? (
        <PulseDot />
      ) : (
        <View className="w-2 h-2 rounded-full bg-muted" />
      )}
      <Text
        className={`text-base font-medium flex-1 ${
          done ? 'text-primary' : active ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
