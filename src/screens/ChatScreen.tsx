import React, { useEffect, useRef } from 'react';
import { View, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useDeployStore } from '../stores/deployStore';
import { useChatStore } from '../stores/chatStore';
import ChatHeader from '../components/chat/ChatHeader';
import ChatInput from '../components/chat/ChatInput';
import MessageBubble from '../components/chat/MessageBubble';
import ConnectingOverlay from '../components/chat/ConnectingOverlay';

export default function ChatScreen() {
  const isReady = useDeployStore((s) => s.isReady);
  const ipAddress = useDeployStore((s) => s.ipAddress);
  const messages = useChatStore((s) => s.messages);
  const connectionState = useChatStore((s) => s.connectionState);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (isReady && ipAddress && connectionState === 'disconnected') {
      useChatStore.getState().connect(ipAddress, '');
    }
    return () => useChatStore.getState().disconnect();
  }, [isReady, ipAddress, connectionState]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ChatHeader />

      {!isReady ? (
        <ConnectingOverlay />
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerClassName="px-4 pt-4 pb-2"
            className="flex-1"
          />
          <ChatInput />
        </>
      )}
    </KeyboardAvoidingView>
  );
}
