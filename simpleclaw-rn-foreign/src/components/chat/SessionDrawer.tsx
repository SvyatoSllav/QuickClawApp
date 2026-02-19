import React, { useEffect } from 'react';
import { View, FlatList, Pressable, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
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
        className={`flex-row items-center px-4 py-3 border-b border-border ${
          isActive ? 'bg-accent' : ''
        }`}
      >
        <View className="flex-1 mr-3">
          <Text
            className={`text-sm ${isActive ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}
            numberOfLines={1}
          >
            {getSessionTitle(item)}
          </Text>
          {item.updatedAt && (
            <Text className="text-xs text-muted-foreground mt-0.5">
              {formatTime(item.updatedAt)}
            </Text>
          )}
        </View>
        {item.key !== 'main' && (
          <Pressable
            onPress={() => handleDelete(item.key)}
            hitSlop={8}
            className="p-1"
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
      {/* Backdrop — fades independently */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          onPress={onClose}
        />
      </Animated.View>

      {/* Drawer panel — slides up from bottom */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: MAX_DRAWER_HEIGHT,
            backgroundColor: '#0a0b0d',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderTopWidth: 1,
            borderTopColor: '#1e1e22',
          },
          drawerStyle,
        ]}
      >
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Text className="text-base font-semibold text-foreground">Sessions</Text>
          <View className="flex-row items-center gap-2">
            <Button variant="outline" size="icon" onPress={handleCreate}>
              <Plus size={18} color={colors.foreground} />
            </Button>
            <Pressable onPress={onClose} hitSlop={8} className="p-1">
              <X size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View className="py-8 items-center">
            <Text className="text-sm text-muted-foreground">Loading...</Text>
          </View>
        ) : sorted.length === 0 ? (
          <View className="py-8 items-center">
            <Text className="text-sm text-muted-foreground">No sessions yet</Text>
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
