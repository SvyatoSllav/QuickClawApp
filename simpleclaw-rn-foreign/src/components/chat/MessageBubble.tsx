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
  body: { color: '#1A1A1A', fontSize: 15, lineHeight: 22 },
  paragraph: { marginTop: 0, marginBottom: 6 },
  strong: { color: '#1A1A1A', fontWeight: '700' },
  em: { color: '#374151', fontStyle: 'italic' },
  link: { color: '#2563EB' },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#E8E0D4',
    paddingLeft: 10,
    marginLeft: 0,
    marginVertical: 6,
  },
  code_inline: {
    backgroundColor: '#F3F4F6',
    color: '#DC2626',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  code_block: {
    backgroundColor: '#F9FAFB',
    color: '#1A1A1A',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'monospace',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fence: {
    backgroundColor: '#F9FAFB',
    color: '#1A1A1A',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'monospace',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  heading1: { color: '#1A1A1A', fontSize: 20, fontWeight: '700', marginVertical: 6 },
  heading2: { color: '#1A1A1A', fontSize: 18, fontWeight: '700', marginVertical: 5 },
  heading3: { color: '#1A1A1A', fontSize: 16, fontWeight: '600', marginVertical: 4 },
  hr: { backgroundColor: '#E8E0D4', height: 1, marginVertical: 8 },
  table: { borderColor: '#E8E0D4' },
  tr: { borderBottomColor: '#E8E0D4' },
  th: { color: '#1A1A1A', fontWeight: '600', padding: 6 },
  td: { color: '#374151', padding: 6 },
});

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isEmpty = !message.content;

  return (
    <View
      className={`max-w-[80%] mb-3 ${isUser ? 'self-end' : 'self-start'}`}
    >
      <View
        style={[
          localStyles.bubble,
          isUser ? localStyles.userBubble : localStyles.assistantBubble,
        ]}
      >
        {isEmpty && !isUser ? (
          <View className="flex-row items-center gap-1 py-1">
            <PulseDot size={6} />
            <PulseDot size={6} />
            <PulseDot size={6} />
          </View>
        ) : isUser ? (
          <Text style={localStyles.userText}>
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

const localStyles = StyleSheet.create({
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userBubble: {
    backgroundColor: '#F5A623',
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E8E0D4',
  },
  userText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#FFFFFF',
  },
});
