import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { ChatMessage } from '../../types/chat';
import PulseDot from '../ui/PulseDot';

interface MessageBubbleProps {
  message: ChatMessage;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isEmpty = !message.content;

  return (
    <View
      className={`max-w-[80%] mb-3 ${isUser ? 'self-end' : 'self-start'}`}
    >
      <View
        className={`px-4 py-3 ${
          isUser
            ? 'bg-primary rounded-2xl rounded-br-sm'
            : 'bg-secondary rounded-2xl rounded-bl-sm'
        }`}
      >
        {isEmpty && !isUser ? (
          <View className="flex-row items-center gap-1 py-1">
            <PulseDot size={6} />
            <PulseDot size={6} />
            <PulseDot size={6} />
          </View>
        ) : (
          <Text
            className={`text-base leading-6 ${
              isUser ? 'text-primary-foreground' : 'text-secondary-foreground'
            }`}
          >
            {message.content}
          </Text>
        )}
      </View>
      <Text
        className={`text-[10px] mt-1 ${
          isUser ? 'text-right' : 'text-left'
        } text-muted-foreground`}
      >
        {formatTime(message.timestamp)}
      </Text>
    </View>
  );
}
