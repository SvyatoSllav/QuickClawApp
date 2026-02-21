import React, { useEffect } from 'react';
import { View, FlatList, Pressable, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Plus, Trash2, X } from 'lucide-react-native';
import { useSessionStore } from '../../stores/sessionStore';
import { useChatStore } from '../../stores/chatStore';
import { Session } from '../../types/session';
import { colors } from '../../config/colors';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MAX_DRAWER_HEIGHT = SCREEN_HEIGHT * 0.7;
const ANIM_DURATION = 280;
const EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

interface Props {
  visible: boolean;
  onClose: () => void;
}

function getSessionTitle(session: Session): string {
  return session.displayName || session.derivedTitle || session.key;
}

function formatTime(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function SessionDrawer({ visible, onClose }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const isLoading = useSessionStore((s) => s.isLoading);
  const switchSession = useSessionStore((s) => s.switchSession);
  const createSession = useSessionStore((s) => s.createSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const activeSessionKey = useChatStore((s) => s.activeSessionKey);

  const translateY = useSharedValue(MAX_DRAWER_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : MAX_DRAWER_HEIGHT, {
      duration: ANIM_DURATION,
      easing: EASING,
    });
    backdropOpacity.value = withTiming(visible ? 1 : 0, {
      duration: ANIM_DURATION,
      easing: EASING,
    });
  }, [visible]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sorted = [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

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

  const renderItem = ({ item }: { item: Session }) => {
    const isActive = item.key === activeSessionKey;
    return (
      <Pressable
        onPress={() => handleSelect(item.key)}
        style={[
          localStyles.sessionItem,
          isActive && localStyles.sessionItemActive,
        ]}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            style={[
              localStyles.sessionTitle,
              isActive && localStyles.sessionTitleActive,
            ]}
            numberOfLines={1}
          >
            {getSessionTitle(item)}
          </Text>
          {item.updatedAt && (
            <Text style={localStyles.sessionTime}>
              {formatTime(item.updatedAt)}
            </Text>
          )}
        </View>
        {item.key !== 'main' && (
          <Pressable
            onPress={() => handleDelete(item.key)}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Trash2 size={16} color={colors.mutedForeground} />
          </Pressable>
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
          <Text style={localStyles.drawerTitle}>{'\u0421\u0435\u0441\u0441\u0438\u0438'}</Text>
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
            <Text style={localStyles.emptyText}>{'\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...'}</Text>
          </View>
        ) : sorted.length === 0 ? (
          <View style={localStyles.emptyState}>
            <Text style={localStyles.emptyText}>{'\u041D\u0435\u0442 \u0441\u0435\u0441\u0441\u0438\u0439'}</Text>
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
    borderTopColor: '#E8E0D4',
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
    borderBottomColor: '#E8E0D4',
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
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
    backgroundColor: '#FEF3C7',
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  sessionTitleActive: {
    fontWeight: '700',
    color: '#F5A623',
  },
  sessionTime: {
    fontSize: 12,
    color: '#8B8B8B',
    marginTop: 2,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#8B8B8B',
  },
});
