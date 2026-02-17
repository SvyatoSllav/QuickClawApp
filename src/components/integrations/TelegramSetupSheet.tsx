import React, { useState } from 'react';
import { View, Modal, Pressable, Linking, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTelegramStore } from '../../stores/telegramStore';
import { useAuthStore } from '../../stores/authStore';
import { useDeployStore } from '../../stores/deployStore';
import { TelegramIcon } from '../icons/ChannelIcons';

const TOKEN_REGEX = /^\d{6,15}:[A-Za-z0-9_-]{30,50}$/;
const PAIRING_CODE_REGEX = /^[A-HJ-NP-Z2-9]{8}$/;

interface TelegramSetupSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function TelegramSetupSheet({ visible, onClose }: TelegramSetupSheetProps) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const isServerReady = useDeployStore((s) => s.isReady);
  const botValidated = profile?.telegramBotValidated ?? false;
  const botUsername = profile?.telegramBotUsername;

  const { step, loading, error, validateToken, submitPairingCode, removeBot, reset } = useTelegramStore();

  const [token, setToken] = useState('');
  const [pairingCode, setPairingCode] = useState('');

  // Determine which view to show
  const showPairing = botValidated || step === 'validated' || step === 'approved';

  const isValidToken = TOKEN_REGEX.test(token);
  const isValidPairingCode = PAIRING_CODE_REGEX.test(pairingCode.toUpperCase());

  const handleClose = () => {
    setToken('');
    setPairingCode('');
    reset();
    onClose();
  };

  const handleValidate = async () => {
    await validateToken(token);
  };

  const handleApprove = async () => {
    await submitPairingCode(pairingCode.toUpperCase());
  };

  const handleDisconnect = async () => {
    await removeBot();
    handleClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <Pressable className="flex-1 bg-black/60" onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="bg-card rounded-t-3xl border-t border-border"
      >
        <ScrollView contentContainerClassName="px-6 pt-6 pb-10" keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-6">
            <TelegramIcon size={32} />
            <Text className="text-xl font-bold flex-1">
              {showPairing ? t('telegramPairing', 'Pair Your Account') : t('telegramConnect', 'Connect Telegram')}
            </Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Text variant="muted" className="text-2xl leading-none">&times;</Text>
            </Pressable>
          </View>

          {showPairing ? (
            <PairingView
              botUsername={botUsername ?? useTelegramStore.getState().botUsername ?? ''}
              step={step}
              loading={loading}
              error={error}
              isServerReady={isServerReady}
              pairingCode={pairingCode}
              isValidPairingCode={isValidPairingCode}
              onCodeChange={setPairingCode}
              onApprove={handleApprove}
              onDisconnect={handleDisconnect}
              t={t}
            />
          ) : (
            <TokenView
              token={token}
              isValidToken={isValidToken}
              loading={loading}
              error={error}
              step={step}
              onTokenChange={setToken}
              onValidate={handleValidate}
              t={t}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- Token Entry View ---------- */

function TokenView({
  token, isValidToken, loading, error, step, onTokenChange, onValidate, t,
}: {
  token: string;
  isValidToken: boolean;
  loading: boolean;
  error: string | null;
  step: string;
  onTokenChange: (v: string) => void;
  onValidate: () => void;
  t: (k: string, d?: string) => string;
}) {
  const tokenError = token.length > 0 && !isValidToken;

  return (
    <View className="gap-4">
      <Text variant="muted" className="text-sm font-medium">
        {t('howToGetToken', 'How to get a bot token:')}
      </Text>

      <View className="gap-2.5 pl-1">
        {[
          { num: '1', text: t('tgStep1', 'Open'), link: true },
          { num: '2', text: t('tgStep2', 'Send the command /newbot') },
          { num: '3', text: t('tgStep3', 'Choose a name and username for your bot') },
          { num: '4', text: t('tgStep4', 'Copy the token you receive') },
          { num: '5', text: t('tgStep5', 'Paste the token below') },
        ].map((s) => (
          <View key={s.num} className="flex-row gap-2.5 items-start">
            <View className="w-5 h-5 rounded-full bg-primary/10 items-center justify-center mt-0.5">
              <Text className="text-primary text-xs font-bold">{s.num}</Text>
            </View>
            {s.link ? (
              <Text className="text-sm flex-1">
                {'Open '}
                <Text
                  className="text-blue-500 text-sm"
                  onPress={() => Linking.openURL('https://t.me/BotFather')}
                >
                  @BotFather
                </Text>
                {' in Telegram'}
              </Text>
            ) : (
              <Text className="text-sm flex-1">{s.text}</Text>
            )}
          </View>
        ))}
      </View>

      <Separator className="my-1" />

      <Text variant="muted" className="text-xs font-medium uppercase" style={{ letterSpacing: 1 }}>
        {t('botTokenLabel', 'Bot Token')}
      </Text>
      <TextInput
        value={token}
        onChangeText={onTokenChange}
        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
        placeholderTextColor="#71717a"
        autoCapitalize="none"
        autoCorrect={false}
        className={`bg-secondary/50 border rounded-xl px-4 py-3 text-foreground text-sm ${
          tokenError ? 'border-destructive' : 'border-border'
        }`}
        style={{ fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}
      />
      {tokenError && (
        <Text className="text-destructive text-xs">
          {t('tokenInvalidFormat', 'Invalid token format')}
        </Text>
      )}
      {error && step === 'error' && (
        <Text className="text-destructive text-xs">{error}</Text>
      )}

      <Button
        onPress={onValidate}
        disabled={!isValidToken || loading}
        className="w-full mt-2"
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text className="font-semibold text-primary-foreground">
            {t('saveAndConnect', 'Save & Connect')}
          </Text>
        )}
      </Button>
    </View>
  );
}

/* ---------- Pairing Code View ---------- */

function PairingView({
  botUsername, step, loading, error, isServerReady, pairingCode, isValidPairingCode,
  onCodeChange, onApprove, onDisconnect, t,
}: {
  botUsername: string;
  step: string;
  loading: boolean;
  error: string | null;
  isServerReady: boolean;
  pairingCode: string;
  isValidPairingCode: boolean;
  onCodeChange: (v: string) => void;
  onApprove: () => void;
  onDisconnect: () => void;
  t: (k: string, d?: string) => string;
}) {
  if (step === 'approved') {
    return (
      <View className="gap-4 items-center py-4">
        <View className="w-16 h-16 rounded-full bg-green-500/20 items-center justify-center">
          <Text className="text-green-500 text-3xl">&#10003;</Text>
        </View>
        <Text className="text-lg font-bold text-center">
          {t('pairingSuccess', 'Pairing approved!')}
        </Text>
        <Text variant="muted" className="text-center text-sm">
          {t('pairingSuccessDesc', 'Your bot is ready to use. Send a message in Telegram to start chatting.')}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      {/* Bot connected banner */}
      <View className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex-row items-center gap-3">
        <TelegramIcon size={20} />
        <View className="flex-1">
          <Text className="text-sm font-medium">@{botUsername}</Text>
          <Text variant="muted" className="text-xs">{t('botConnected', 'Bot connected')}</Text>
        </View>
        <View className="bg-green-500/20 px-2 py-0.5 rounded-full">
          <Text className="text-green-500 text-xs font-medium">&#10003;</Text>
        </View>
      </View>

      <Separator />

      {/* Instructions */}
      <Text className="text-sm leading-6">
        {t('pairingInstructions', 'Send any message to your bot in Telegram. You will receive an 8-character pairing code. Enter it below to approve access.')}
      </Text>

      {!isServerReady && (
        <View className="bg-secondary/50 border border-border rounded-xl px-4 py-3 flex-row items-center gap-3">
          <ActivityIndicator size="small" />
          <Text variant="muted" className="text-sm">
            {t('pairingWaitServer', 'Waiting for server to be ready...')}
          </Text>
        </View>
      )}

      {/* Code input */}
      <Text variant="muted" className="text-xs font-medium uppercase" style={{ letterSpacing: 1 }}>
        {t('pairingCodeLabel', 'Pairing Code')}
      </Text>
      <TextInput
        value={pairingCode}
        onChangeText={(v) => onCodeChange(v.toUpperCase().slice(0, 8))}
        placeholder="ABCDEFGH"
        placeholderTextColor="#71717a"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        editable={isServerReady}
        className={`bg-secondary/50 border border-border rounded-xl px-4 py-3 text-foreground text-center text-lg tracking-widest ${
          !isServerReady ? 'opacity-50' : ''
        }`}
        style={{ fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, letterSpacing: 4 }}
      />

      <Text variant="muted" className="text-xs text-center">
        {t('pairingExpireNote', 'Codes expire after 1 hour')}
      </Text>

      {error && step === 'error' && (
        <Text className="text-destructive text-xs text-center">{error}</Text>
      )}

      <Button
        onPress={onApprove}
        disabled={!isValidPairingCode || loading || !isServerReady}
        className="w-full"
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text className="font-semibold text-primary-foreground">
            {t('pairingApprove', 'Approve')}
          </Text>
        )}
      </Button>

      <Separator className="my-1" />

      <Button variant="ghost" onPress={onDisconnect} className="self-center">
        <Text className="text-destructive text-xs font-medium">
          {t('disconnectBot', 'Disconnect Bot')}
        </Text>
      </Button>
    </View>
  );
}
