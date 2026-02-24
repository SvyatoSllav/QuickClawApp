import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, FlatList, Keyboard, Platform, Pressable, NativeSyntheticEvent, NativeScrollEvent, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { ArrowDown } from 'lucide-react-native';
import { useDeployStore } from '../stores/deployStore';
import { useChatStore } from '../stores/chatStore';
import { useSessionStore } from '../stores/sessionStore';
import ChatHeader from '../components/chat/ChatHeader';
import ChatInput from '../components/chat/ChatInput';
import MessageBubble from '../components/chat/MessageBubble';
import ConnectingOverlay from '../components/chat/ConnectingOverlay';
import SpinnerIcon from '../components/ui/SpinnerIcon';
import { Text } from '@/components/ui/text';
import { colors } from '../config/colors';

const SCROLL_THRESHOLD = 120;

export default function ChatScreen() {
  const isReady = useDeployStore((s) => s.isReady);
  const messages = useChatStore((s) => s.messages);
  const connectionState = useChatStore((s) => s.connectionState);
  const isLoadingHistory = useChatStore((s) => s.isLoadingHistory);
  const flatListRef = useRef<FlatList>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const fabOpacity = useSharedValue(0);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Filter out blank assistant messages except the last one (loading indicator)
  const visibleMessages = React.useMemo(() => {
    const lastMsg = messages[messages.length - 1];
    const isLastLoading = lastMsg && lastMsg.role === 'assistant' && !lastMsg.content;
    return messages.filter((msg, idx) => {
      if (msg.role === 'assistant' && !msg.content) {
        return isLastLoading && idx === messages.length - 1;
      }
      return true;
    });
  }, [messages]);

  // Loading state: server ready but WS not connected yet, or history still fetching
  const isInitialLoading = isReady && (
    connectionState !== 'connected' || isLoadingHistory
  );

  // Fetch sessions when connection comes up (WS managed globally in app/index.tsx)
  useEffect(() => {
    if (connectionState === 'connected') {
      useSessionStore.getState().fetchSessions();
    }
  }, [connectionState]);

  // Track whether we need to snap to bottom on next content size change
  const needsSnapToBottom = useRef(true);
  useEffect(() => {
    if (isLoadingHistory) {
      needsSnapToBottom.current = true;
    }
  }, [isLoadingHistory]);

  // onContentSizeChange fires AFTER FlatList has measured all items — reliable scroll point
  const handleContentSizeChange = useCallback((_w: number, h: number) => {
    if (h === 0) return;
    if (needsSnapToBottom.current && visibleMessages.length > 0 && !isInitialLoading) {
      needsSnapToBottom.current = false;
      setIsAtBottom(true);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
    } else if (isAtBottom) {
      flatListRef.current?.scrollToEnd({ animated: false });
    }
  }, [visibleMessages.length, isInitialLoading, isAtBottom]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const atBottom = distanceFromBottom < SCROLL_THRESHOLD;
    setIsAtBottom(atBottom);
    fabOpacity.value = withTiming(atBottom ? 0 : 1, { duration: 200 });
  }, []);

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const fabStyle = useAnimatedStyle(() => ({
    opacity: fabOpacity.value,
    pointerEvents: fabOpacity.value === 0 ? 'none' as const : 'auto' as const,
  }));

  const showEmptyState = isReady && !isInitialLoading && !isLoadingHistory && visibleMessages.length === 0;

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.background, paddingBottom: keyboardHeight > 0 ? keyboardHeight + 8 : 0 }}
    >
      <ChatHeader />

      {!isReady ? (
        <ConnectingOverlay />
      ) : isInitialLoading ? (
        <View style={localStyles.emptyState}>
          <SpinnerIcon size={36} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {showEmptyState ? (
            <View style={localStyles.emptyState}>
              <View style={localStyles.emptyIcon}>
                <Text style={{ fontSize: 40 }}>{'\uD83E\uDD80'}</Text>
              </View>
              <Text style={localStyles.emptyTitle}>Start a conversation</Text>
              <Text style={localStyles.emptySubtitle}>Select an agent or type a message</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={visibleMessages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <MessageBubble message={item} />}
              contentContainerClassName="px-4 pt-4 pb-2"
              className="flex-1"
              onContentSizeChange={handleContentSizeChange}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
          )}

          {/* Scroll-to-bottom FAB */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                right: 16,
                bottom: 80,
              },
              fabStyle,
            ]}
          >
            <Pressable
              onPress={scrollToBottom}
              style={localStyles.fab}
            >
              <ArrowDown size={20} color="#6B7280" />
            </Pressable>
          </Animated.View>

          <ChatInput />
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
});
