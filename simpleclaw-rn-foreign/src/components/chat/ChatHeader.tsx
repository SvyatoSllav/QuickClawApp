import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Menu, ChevronDown } from 'lucide-react-native';
import { useNavigationStore } from '../../stores/navigationStore';
import { useChatStore } from '../../stores/chatStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useAgentStore } from '../../stores/agentStore';
import { AVAILABLE_MODELS, ModelId } from '../../types/chat';
import { getModelIcon } from '../icons/ModelIcons';
import { colors } from '../../config/colors';

export default function ChatHeader() {
  const insets = useSafeAreaInsets();
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);
  const openSessionDrawer = useNavigationStore((s) => s.openSessionDrawer);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const activeSessionKey = useChatStore((s) => s.activeSessionKey);
  const setModel = useChatStore((s) => s.setModel);
  const sessions = useSessionStore((s) => s.sessions);
  const agents = useAgentStore((s) => s.agents);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const [showDropdown, setShowDropdown] = useState(false);

  const currentModel = AVAILABLE_MODELS.find((m) => m.id === selectedModel);
  const CurrentModelIcon = currentModel ? getModelIcon(currentModel.icon) : null;

  // Derive session title with agent name fallback
  const activeSession = sessions.find((s) => s.key === activeSessionKey);
  const activeAgent = agents.find((a) => a.id === activeAgentId);
  const sessionTitle = activeSession?.displayName
    || activeSession?.derivedTitle
    || activeAgent?.name
    || 'New chat';

  const handleSelect = async (id: ModelId) => {
    await setModel(id);
    setShowDropdown(false);
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        {/* Hamburger */}
        <Pressable onPress={toggleSidebar} hitSlop={8} style={styles.hamburger}>
          <Menu size={22} color={colors.foreground} />
        </Pressable>

        {/* Session name + chevron (centered, clickable) */}
        <Pressable onPress={openSessionDrawer} style={styles.sessionPill}>
          <Text style={styles.sessionText} numberOfLines={1}>{sessionTitle}</Text>
          <ChevronDown size={16} color={colors.mutedForeground} />
        </Pressable>

        {/* Model icon button */}
        <Pressable
          onPress={() => setShowDropdown(!showDropdown)}
          style={styles.modelButton}
        >
          {CurrentModelIcon && <CurrentModelIcon size={18} />}
        </Pressable>
      </View>

      {/* Model dropdown */}
      {showDropdown && (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowDropdown(false)}
          />
          <View style={styles.dropdown}>
            {AVAILABLE_MODELS.map((model) => {
              const ModelIcon = getModelIcon(model.icon);
              const isSelected = selectedModel === model.id;
              return (
                <Pressable
                  key={model.id}
                  onPress={() => handleSelect(model.id)}
                  style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                >
                  <ModelIcon size={16} />
                  <Text style={[styles.dropdownLabel, isSelected && styles.dropdownLabelActive]}>
                    {model.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 50,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  hamburger: {
    padding: 4,
  },
  sessionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginHorizontal: 12,
  },
  sessionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    flexShrink: 1,
  },
  modelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E0D4',
    paddingVertical: 4,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemActive: {
    backgroundColor: '#FEF3C7',
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  dropdownLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
