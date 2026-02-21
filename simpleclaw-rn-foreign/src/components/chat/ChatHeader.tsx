import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Menu, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useNavigationStore } from '../../stores/navigationStore';
import { useChatStore } from '../../stores/chatStore';
import { useSessionStore } from '../../stores/sessionStore';
import { useAgentStore } from '../../stores/agentStore';
import { AVAILABLE_MODELS, ModelId } from '../../types/chat';
import { getModelIcon, MODEL_COLORS } from '../icons/ModelIcons';
import { colors } from '../../config/colors';

export default function ChatHeader() {
  const insets = useSafeAreaInsets();
  const toggleSidebar = useNavigationStore((s) => s.toggleSidebar);
  const openSessionDrawer = useNavigationStore((s) => s.openSessionDrawer);
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
    <View style={styles.wrapper}>
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        {/* Hamburger */}
        <Pressable onPress={toggleSidebar} hitSlop={8} style={styles.hamburger}>
          <Menu size={22} color={colors.foreground} />
        </Pressable>

        {/* Title */}
        <Pressable onPress={openSessionDrawer} style={styles.titleArea}>
          <Text style={styles.title}>{'\u0421\u0435\u0441\u0441\u0438\u0438'}</Text>
        </Pressable>

        {/* Model selector pill */}
        <Pressable
          onPress={() => setShowDropdown(!showDropdown)}
          style={styles.modelPill}
        >
          {CurrentModelIcon && <CurrentModelIcon size={14} />}
          <Text style={styles.modelPillText}>{currentModel?.label ?? 'Model'}</Text>
          {showDropdown ? (
            <ChevronUp size={14} color={colors.foreground} />
          ) : (
            <ChevronDown size={14} color={colors.foreground} />
          )}
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
  titleArea: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modelPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
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
