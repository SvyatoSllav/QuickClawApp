import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import OptionsCard from '../../components/ui/OptionsCard';
import { useSelectionStore } from '../../stores/selectionStore';

const models = [
  {
    id: 'gemini-3-flash',
    name: 'Gemini',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Google_Gemini_icon_2025.svg/960px-Google_Gemini_icon_2025.svg.png',
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude (Sonnet 4)',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg',
  },
  {
    id: 'gpt-4o',
    name: 'GPT',
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg',
  },
];

export default function ModelSelector() {
  const { t } = useTranslation();
  const selectedModel = useSelectionStore((s) => s.selectedModel);
  const setModel = useSelectionStore((s) => s.setModel);

  return (
    <View>
      <Text className="text-white font-medium text-base mb-3">
        {t('modelQuestion')}
      </Text>
      {models.map((model, index) => (
        <View key={model.id} className={index < models.length - 1 ? 'mb-3' : ''}>
          <OptionsCard
            selected={selectedModel === model.id}
            onPress={() => setModel(model.id)}
          >
            <View className="flex-row items-center">
              <Image
                source={{ uri: model.iconUrl }}
                style={{ width: 20, height: 20 }}
                contentFit="contain"
              />
              <Text
                className={`ml-2 flex-1 text-sm font-medium ${
                  selectedModel === model.id ? 'text-white' : 'text-zinc-400'
                }`}
              >
                {model.name}
              </Text>
              {selectedModel === model.id && (
                <Text className="text-zinc-400">✓</Text>
              )}
            </View>
          </OptionsCard>
        </View>
      ))}
    </View>
  );
}
