import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Text } from '@/components/ui/text';
import { colors } from '../../config/colors';
import type { OpenClawPrompt } from '../../data/openclawPrompts';

interface Props {
  prompt: OpenClawPrompt;
  onPress: (prompt: OpenClawPrompt) => void;
}

export default function PromptCard({ prompt, onPress }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Pressable style={s.card} onPress={() => onPress(prompt)}>
      <View style={s.header}>
        <Text style={s.title} numberOfLines={1}>
          {prompt.title}
        </Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          hitSlop={8}
          style={s.copyButton}
        >
          {copied ? (
            <Check size={16} color={colors.primary} />
          ) : (
            <Copy size={16} color={colors.primary} />
          )}
        </Pressable>
      </View>
      <View style={s.body}>
        <View style={s.codeBlock}>
          <Text style={s.codeText} numberOfLines={3}>
            {prompt.prompt}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
    marginRight: 12,
  },
  copyButton: {
    padding: 4,
  },
  body: {
    padding: 12,
  },
  codeBlock: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#374151',
    lineHeight: 18,
  },
});
