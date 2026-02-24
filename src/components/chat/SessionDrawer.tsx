import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, FlatList, Pressable, Dimensions, StyleSheet, TextInput } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Plus, Trash2, X, Pencil } from 'lucide-react-native';
import { useSessionStore } from '../../stores/sessionStore';
import { useChatStore } from '../../stores/chatStore';
import { Session } from '../../types/session';
import { colors } from '../../config/colors';
import { TIMING } from '../../config/constants';
import { formatSessionTime } from '../../utils/formatters';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MAX_DRAWER_HEIGHT = SCREEN_HEIGHT * 0.7;
const EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

interface Props {
  visible: boolean;
  onClose: () => void;
}

function getSessionTitle(session: Session): string {
  return session.displayName || session.derivedTitle || session.key;
}

export default function SessionDrawer({ visible, onClose }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const isLoading = useSessionStore((s) => s.isLoading);
  const switchSession = useSessionStore((s) => s.switchSession);
  const createSession = useSessionStore((s) => s.createSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const renameSession = useSessionStore((s) => s.renameSession);
  const activeSessionKey = useChatStore((s) => s.activeSessionKey);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<TextInput>(null);

  const translateY = useSharedValue(MAX_DRAWER_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : MAX_DRAWER_HEIGHT, {
      duration: TIMING.ANIMATION_DURATION_MS,
      easing: EASING,
    });
    backdropOpacity.value = withTiming(visible ? 1 : 0, {
      duration: TIMING.ANIMATION_DURATION_MS,
      easing: EASING,
    });
  }, [visible]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [sessions],
  );

  const handleSelect = (key: string) => {
    switchSession(key);
    onClose();
  };

  const handleCreate = () => {
    createSession();
    onClose();
  };

  const handleDelete = (key: string) => {
    deleteSession(key);
  };

  const handleLongPress = (item: Session) => {
    setEditingKey(item.key);
    setEditText(getSessionTitle(item));
    setTimeout(() => editInputRef.current?.focus(), 100);
  };

  const handleRenameSubmit = () => {
    if (editingKey && editText.trim()) {
      renameSession(editingKey, editText.trim());
    }
    setEditingKey(null);
    setEditText('');
  };

  const renderItem = ({ item }: { item: Session }) => {
    const isActive = item.key === activeSessionKey;
    const isEditing = editingKey === item.key;
    return (
      <Pressable
        onPress={() => isEditing ? undefined : handleSelect(item.key)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={TIMING.LONGPRESS_DELAY_MS}
        style={[
          localStyles.sessionItem,
          isActive && localStyles.sessionItemActive,
        ]}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          {isEditing ? (
            <TextInput
              ref={editInputRef}
              value={editText}
              onChangeText={setEditText}
              onSubmitEditing={handleRenameSubmit}
              onBlur={handleRenameSubmit}
              style={[
                localStyles.sessionTitle,
                isActive && localStyles.sessionTitleActive,
                localStyles.sessionEditInput,
              ]}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
            />
          ) : (
            <Text
              style={[
                localStyles.sessionTitle,
                isActive && localStyles.sessionTitleActive,
              ]}
              numberOfLines={1}
            >
              {getSessionTitle(item)}
            </Text>
          )}
          {item.updatedAt && !isEditing && (
            <Text style={localStyles.sessionTime}>
              {formatSessionTime(item.updatedAt)}
            </Text>
          )}
        </View>
        {item.key !== 'main' && !isEditing && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable
              onPress={() => handleLongPress(item)}
              hitSlop={8}
              style={{ padding: 4 }}
            >
              <Pencil size={14} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              onPress={() => handleDelete(item.key)}
              hitSlop={8}
              style={{ padding: 4 }}
            >
              <Trash2 size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
          onPress={onClose}
        />
      </Animated.View>

      <Animated.View
        style={[
          localStyles.drawer,
          drawerStyle,
        ]}
      >
        <View style={localStyles.drawerHeader}>
          <Text style={localStyles.drawerTitle}>Sessions</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={handleCreate} style={localStyles.addButton}>
              <Plus size={18} color={colors.primary} />
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
              <X size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View style={localStyles.emptyState}>
            <Text style={localStyles.emptyText}>Loading...</Text>
          </View>
        ) : sorted.length === 0 ? (
          <View style={localStyles.emptyState}>
            <Text style={localStyles.emptyText}>No sessions</Text>
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
          />
        )}
      </Animated.View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: MAX_DRAWER_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8DC',
  },
  sessionItemActive: {
    backgroundColor: colors.accent,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  sessionTitleActive: {
    fontWeight: '700',
    color: colors.primary,
  },
  sessionEditInput: {
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: 2,
    paddingHorizontal: 0,
    margin: 0,
  },
  sessionTime: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
});
