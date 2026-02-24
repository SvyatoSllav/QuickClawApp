import React from 'react';
import { View, Text as RNText, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/text';
import Markdown from 'react-native-markdown-display';
import { ChatMessage } from '../../types/chat';
import PulseDot from '../ui/PulseDot';
import { colors } from '../../config/colors';
import { formatTime } from '../../utils/formatters';

interface MessageBubbleProps {
  message: ChatMessage;
}

const mdStyles = StyleSheet.create({
  body: { color: colors.foreground, fontSize: 15, lineHeight: 22, userSelect: 'text' } as any,
  paragraph: { marginTop: 0, marginBottom: 6 },
  strong: { color: colors.foreground, fontWeight: '700' },
  em: { color: '#374151', fontStyle: 'italic' },
  link: { color: '#2563EB' },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
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
    color: colors.foreground,
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
    color: colors.foreground,
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
  heading1: { color: colors.foreground, fontSize: 20, fontWeight: '700', marginVertical: 6 },
  heading2: { color: colors.foreground, fontSize: 18, fontWeight: '700', marginVertical: 5 },
  heading3: { color: colors.foreground, fontSize: 16, fontWeight: '600', marginVertical: 4 },
  hr: { backgroundColor: colors.border, height: 1, marginVertical: 8 },
  table: { borderColor: colors.border },
  tr: { borderBottomColor: colors.border },
  th: { color: colors.foreground, fontWeight: '600', padding: 6 },
  td: { color: '#374151', padding: 6 },
});

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isEmpty = !message.content;

  return (
    <View
      className={`mb-3 ${isUser ? 'max-w-[80%] self-end' : 'w-full self-start'}`}
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
          <RNText selectable style={localStyles.userText}>
            {message.content}
          </RNText>
        ) : (
          <Markdown style={mdStyles} mergeStyle>{message.content}</Markdown>
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
    backgroundColor: colors.primary,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#FFFFFF',
  },
});
