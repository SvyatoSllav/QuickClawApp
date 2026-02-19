import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, FlatList, KeyboardAvoidingView, Platform, Pressable, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { ArrowDown } from 'lucide-react-native';
import { useDeployStore } from '../stores/deployStore';
import { useChatStore } from '../stores/chatStore';
import { useSessionStore } from '../stores/sessionStore';
import ChatHeader from '../components/chat/ChatHeader';
import ChatInput from '../components/chat/ChatInput';
import MessageBubble from '../components/chat/MessageBubble';
import ConnectingOverlay from '../components/chat/ConnectingOverlay';

const SCROLL_THRESHOLD = 120;

export default function ChatScreen() {
  const isReady = useDeployStore((s) => s.isReady);
  const ipAddress = useDeployStore((s) => s.ipAddress);
  const gatewayToken = useDeployStore((s) => s.gatewayToken);
  const messages = useChatStore((s) => s.messages);
  const connectionState = useChatStore((s) => s.connectionState);
  const isLoadingHistory = useChatStore((s) => s.isLoadingHistory);
  const flatListRef = useRef<FlatList>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const fabOpacity = useSharedValue(0);

  useEffect(() => {
    if (isReady && ipAddress) {
      useChatStore.getState().connect(ipAddress, gatewayToken ?? '');
    }
    return () => useChatStore.getState().disconnect();
  }, [isReady, ipAddress, gatewayToken]);

  // Fetch session list when WebSocket connects
  useEffect(() => {
    if (connectionState === 'connected') {
      useSessionStore.getState().fetchSessions();
    }
  }, [connectionState]);

  // Auto-scroll on new messages (only if already at bottom)
  useEffect(() => {
    if (messages.length > 0 && isAtBottom) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // Scroll to bottom after history loads
  const prevLoading = useRef(isLoadingHistory);
  useEffect(() => {
    if (prevLoading.current && !isLoadingHistory) {
      // History just finished loading — scroll to bottom
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);
    }
    prevLoading.current = isLoadingHistory;
  }, [isLoadingHistory]);

  const handleContentSizeChange = () => {
    if (messages.length > 0 && isAtBottom) {
      flatListRef.current?.scrollToEnd({ animated: false });
    }
  };

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

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ChatHeader />

      {!isReady ? (
        <ConnectingOverlay />
      ) : (
        <View className="flex-1">
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerClassName="px-4 pt-4 pb-2"
            className="flex-1"
            onContentSizeChange={handleContentSizeChange}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />

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
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#27272a',
                borderWidth: 1,
                borderColor: '#3f3f46',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowDown size={20} color="#a1a1aa" />
            </Pressable>
          </Animated.View>

          <ChatInput />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
