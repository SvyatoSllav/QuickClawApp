import React, { useState } from 'react';
import { View, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Menu, ChevronDown } from 'lucide-react-native';
import { useNavigationStore } from '../../stores/navigationStore';
import { useChatStore } from '../../stores/chatStore';
import { useSessionStore } from '../../stores/sessionStore';
import { AVAILABLE_MODELS, ModelId } from '../../types/chat';
import { getModelIcon, MODEL_COLORS } from '../icons/ModelIcons';
import { colors } from '../../config/colors';
import SessionDrawer from './SessionDrawer';

function getActiveSessionTitle(activeKey: string, sessions: { key: string; displayName?: string; derivedTitle?: string }[]): string {
  const session = sessions.find((s) => s.key === activeKey);
  if (session) return session.displayName || session.derivedTitle || session.key;
  if (activeKey === 'main') return 'Main';
  return activeKey;
}

export default function ChatHeader() {
  const insets = useSafeAreaInsets();
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setModel = useChatStore((s) => s.setModel);
  const activeSessionKey = useChatStore((s) => s.activeSessionKey);
  const sessions = useSessionStore((s) => s.sessions);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  const currentModel = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
  const CurrentModelIcon = currentModel ? getModelIcon(currentModel.icon) : null;

  const handleSelect = async (id: ModelId) => {
    await setModel(id);
    setShowDropdown(false);
  };

  const sessionTitle = getActiveSessionTitle(activeSessionKey, sessions);

  return (
    <View className="relative z-50">
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-border" style={{ paddingTop: insets.top + 8 }}>
        <Button variant="outline" size="icon" onPress={toggleSidebar}>
          <Menu size={18} color="#fafafa" />
        </Button>

        <Pressable
          onPress={() => setShowSessions(true)}
          className="flex-1 mx-3 flex-row items-center justify-center gap-1"
        >
          <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
            {sessionTitle}
          </Text>
          <ChevronDown size={14} color={colors.mutedForeground} />
        </Pressable>

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

      <SessionDrawer visible={showSessions} onClose={() => setShowSessions(false)} />
    </View>
  );
}
