import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useChatStore } from '../../stores/chatStore';
import { AVAILABLE_MODELS, ModelId } from '../../types/chat';

interface ModelSelectorProps {
  onClose: () => void;
}

export default function ModelSelector({ onClose }: ModelSelectorProps) {
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setModel = useChatStore((s) => s.setModel);

  const handleSelect = async (id: ModelId) => {
    await setModel(id);
    onClose();
  };

  return (
    <View className="absolute top-full right-4 mt-px bg-cream border border-divider z-50 w-52">
      {AVAILABLE_MODELS.map((model, i) => (
        <Pressable
          key={model.id}
          onPress={() => handleSelect(model.id)}
          className={`px-4 py-3 flex-row items-center ${
            i > 0 ? 'border-t border-divider' : ''
          } ${selectedModel === model.id ? 'bg-white' : ''}`}
        >
          <Text className="text-jet text-sm flex-1 font-medium">{model.label}</Text>
          {selectedModel === model.id && (
            <Text className="text-cobalt text-sm font-bold">*</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
