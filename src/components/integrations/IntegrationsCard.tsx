import React from 'react';
import { View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { useAuthStore } from '../../stores/authStore';
import { TelegramIcon, DiscordIcon, WhatsAppIcon } from '../icons/ChannelIcons';

interface IntegrationsCardProps {
  onTelegramPress: () => void;
}

const CHANNELS = [
  { id: 'telegram', nameKey: 'telegram', Icon: TelegramIcon, disabled: false },
  { id: 'discord', nameKey: 'discord', Icon: DiscordIcon, disabled: true },
  { id: 'whatsapp', nameKey: 'whatsApp', Icon: WhatsAppIcon, disabled: true },
] as const;

export default function IntegrationsCard({ onTelegramPress }: IntegrationsCardProps) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const telegramConnected = profile?.telegramBotValidated ?? false;
  const telegramUsername = profile?.telegramBotUsername;

  return (
    <Card>
      <CardHeader>
        <Text variant="muted" className="text-xs font-medium uppercase" style={{ letterSpacing: 1.5 }}>
          {t('integrations', 'INTEGRATIONS')}
        </Text>
      </CardHeader>
      <CardContent className="gap-1">
        {CHANNELS.map((channel) => {
          const isConnected = channel.id === 'telegram' && telegramConnected;
          const subtitle = channel.disabled
            ? t('comingSoon', 'Coming Soon')
            : isConnected
              ? `@${telegramUsername}`
              : t('tapToConnect', 'Tap to connect');

          return (
            <Pressable
              key={channel.id}
              onPress={channel.id === 'telegram' ? onTelegramPress : undefined}
              disabled={channel.disabled}
              className={`flex-row items-center gap-3 px-3 py-3 rounded-lg ${
                channel.disabled ? 'opacity-40' : 'active:bg-accent'
              }`}
            >
              <channel.Icon size={28} />
              <View className="flex-1">
                <Text className="font-medium text-sm">{channel.nameKey === 'whatsApp' ? 'WhatsApp' : channel.nameKey.charAt(0).toUpperCase() + channel.nameKey.slice(1)}</Text>
                <Text variant="muted" className="text-xs">{subtitle}</Text>
              </View>
              {isConnected && (
                <View className="bg-green-500/20 px-2 py-0.5 rounded-full">
                  <Text className="text-green-500 text-xs font-medium">{t('connected', 'Connected')}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </CardContent>
    </Card>
  );
}
