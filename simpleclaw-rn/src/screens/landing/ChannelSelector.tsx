import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import OptionsCard from '../../components/ui/OptionsCard';
import { useSelectionStore } from '../../stores/selectionStore';
import { useTelegramStore } from '../../stores/telegramStore';

const channels = [
  {
    id: 'telegram',
    name: 'Telegram',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/960px-Telegram_logo.svg.png',
    disabled: false,
  },
  {
    id: 'discord',
    name: 'Discord',
    iconUrl: 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png',
    disabled: true,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/960px-WhatsApp.svg.png',
    disabled: true,
  },
];

export default function ChannelSelector() {
  const { t } = useTranslation();
  const selectedChannel = useSelectionStore((s) => s.selectedChannel);
  const setChannel = useSelectionStore((s) => s.setChannel);
  const showModal = useTelegramStore((s) => s.showModal);

  const onChannelTap = (channel: typeof channels[number]) => {
    if (channel.disabled) return;
    setChannel(channel.id);
    if (channel.id === 'telegram') {
      showModal();
    }
  };

  return (
    <View>
      <Text className="text-white font-medium text-base mb-3">
        {t('channelQuestion')}
      </Text>
      {channels.map((channel, index) => (
        <View key={channel.id} className={index < channels.length - 1 ? 'mb-3' : ''}>
          <OptionsCard
            selected={selectedChannel === channel.id}
            disabled={channel.disabled}
            onPress={() => onChannelTap(channel)}
          >
            <View className="flex-row items-center">
              <Image
                source={{ uri: channel.iconUrl }}
                style={{ width: 20, height: 20 }}
                contentFit="contain"
              />
              <Text
                className={`ml-2 flex-1 text-sm font-medium ${
                  selectedChannel === channel.id ? 'text-white' : 'text-zinc-400'
                }`}
              >
                {channel.name}
              </Text>
              {selectedChannel === channel.id && (
                <Text className="text-zinc-400">✓</Text>
              )}
              {channel.disabled && (
                <Text className="text-zinc-400 text-xs">{t('soon')}</Text>
              )}
            </View>
          </OptionsCard>
        </View>
      ))}
    </View>
  );
}
