import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useNavigationStore } from '../../stores/navigationStore';
import { useChatStore } from '../../stores/chatStore';
import { AVAILABLE_MODELS, ModelId } from '../../types/chat';
import ProfileIcon from '../icons/ProfileIcon';
import { getModelIcon, MODEL_COLORS } from '../icons/ModelIcons';

export default function ChatHeader() {
  const setScreen = useNavigationStore((s) => s.setScreen);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setModel = useChatStore((s) => s.setModel);
  const [showDropdown, setShowDropdown] = useState(false);

  const currentModel = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
  const CurrentModelIcon = currentModel ? getModelIcon(currentModel.icon) : null;

  const handleSelect = async (id: ModelId) => {
    await setModel(id);
    setShowDropdown(false);
  };

  return (
    <View className="relative z-50">
      <View className="flex-row items-center justify-between px-4 h-14 border-b border-border">
        <Button variant="outline" size="icon" onPress={() => setScreen('profile')}>
          <ProfileIcon size={18} color="#fafafa" />
        </Button>

        <Text className="font-bold text-base uppercase" style={{ letterSpacing: 1.5 }}>
          SimpleClaw
        </Text>

        <Button
          variant="outline"
          size="icon"
          onPress={() => setShowDropdown(!showDropdown)}
        >
          {CurrentModelIcon && <CurrentModelIcon size={18} />}
        </Button>
      </View>

      {showDropdown && (
        <>
          <Pressable
            className="absolute inset-0 z-40"
            style={{ top: -1000, bottom: -1000, left: -1000, right: -1000 }}
            onPress={() => setShowDropdown(false)}
          />
          <View className="absolute top-full right-4 mt-px bg-popover border border-border rounded-md z-50 w-52 shadow-md shadow-black/20">
            {AVAILABLE_MODELS.map((model, i) => {
              const ModelIcon = getModelIcon(model.icon);
              return (
                <Pressable
                  key={model.id}
                  onPress={() => handleSelect(model.id)}
                  className={`px-3 py-2.5 flex-row items-center gap-3 ${
                    i > 0 ? 'border-t border-border' : ''
                  } ${selectedModel === model.id ? 'bg-accent' : ''}`}
                >
                  <ModelIcon size={16} />
                  <Text className="text-sm flex-1 font-medium">{model.label}</Text>
                  {selectedModel === model.id && (
                    <Text className="text-primary text-sm font-bold">✓</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}
