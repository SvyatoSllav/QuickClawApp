import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { useDeployStore } from '../../stores/deployStore';
import SpinnerIcon from '../ui/SpinnerIcon';
import PulseDot from '../ui/PulseDot';
import { colors } from '../../config/colors';

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
    <View style={localStyles.container}>
      <SpinnerIcon size={48} />
      <Text style={localStyles.title}>
        {t('connecting')}
      </Text>
      <Text style={localStyles.subtitle}>
        {t('connectingDesc')}
      </Text>

      <View style={localStyles.stepsContainer}>
        <StepRow label={t('serverAssigning')} done={assigned} active={!assigned} index="01" />
        <StepRow label={t('configuringAgent')} done={openclawRunning} active={assigned && !openclawRunning} index="02" />
        <StepRow label={t('agentReady')} done={false} active={openclawRunning} index="03" />
      </View>
    </View>
  );
}

function StepRow({ label, done, active, index }: { label: string; done: boolean; active: boolean; index: string }) {
  return (
    <View style={stepStyles.row}>
      <Text style={stepStyles.index}>{index}</Text>
      {done ? (
        <Text style={stepStyles.doneLabel}>DONE</Text>
      ) : active ? (
        <PulseDot />
      ) : (
        <View style={stepStyles.inactiveDot} />
      )}
      <Text
        style={[
          stepStyles.label,
          done && stepStyles.labelDone,
          active && stepStyles.labelActive,
          !done && !active && stepStyles.labelInactive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 24,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 32,
  },
  stepsContainer: {
    width: '100%',
    gap: 16,
  },
});

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    flexWrap: 'nowrap',
  },
  index: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
    minWidth: 24,
    letterSpacing: 2,
  },
  doneLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  inactiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  labelDone: {
    color: colors.primary,
  },
  labelActive: {
    color: colors.foreground,
  },
  labelInactive: {
    color: colors.mutedForeground,
  },
});
