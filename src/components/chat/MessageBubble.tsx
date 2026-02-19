import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/text';
import Markdown from 'react-native-markdown-display';
import { ChatMessage } from '../../types/chat';
import PulseDot from '../ui/PulseDot';

interface MessageBubbleProps {
  message: ChatMessage;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const mdStyles = StyleSheet.create({
  body: { color: '#e4e4e7', fontSize: 15, lineHeight: 22 },
  paragraph: { marginTop: 0, marginBottom: 6 },
  strong: { color: '#f4f4f5', fontWeight: '700' },
  em: { color: '#e4e4e7', fontStyle: 'italic' },
  link: { color: '#60a5fa' },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#3f3f46',
    paddingLeft: 10,
    marginLeft: 0,
    marginVertical: 6,
  },
  code_inline: {
    backgroundColor: '#27272a',
    color: '#a5f3fc',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  code_block: {
    backgroundColor: '#18181b',
    color: '#a5f3fc',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'monospace',
    marginVertical: 6,
  },
  fence: {
    backgroundColor: '#18181b',
    color: '#a5f3fc',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'monospace',
    marginVertical: 6,
  },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  heading1: { color: '#f4f4f5', fontSize: 20, fontWeight: '700', marginVertical: 6 },
  heading2: { color: '#f4f4f5', fontSize: 18, fontWeight: '700', marginVertical: 5 },
  heading3: { color: '#f4f4f5', fontSize: 16, fontWeight: '600', marginVertical: 4 },
  hr: { backgroundColor: '#3f3f46', height: 1, marginVertical: 8 },
  table: { borderColor: '#3f3f46' },
  tr: { borderBottomColor: '#3f3f46' },
  th: { color: '#f4f4f5', fontWeight: '600', padding: 6 },
  td: { color: '#e4e4e7', padding: 6 },
});

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
        ) : isUser ? (
          <Text className="text-base leading-6 text-primary-foreground">
            {message.content}
          </Text>
        ) : (
          <Markdown style={mdStyles}>{message.content}</Markdown>
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
