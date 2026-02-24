import React, { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { ArrowLeft, Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Text } from '@/components/ui/text';
import { colors } from '../../config/colors';
import { TIMING } from '../../config/constants';
import type { OpenClawPrompt } from '../../data/openclawPrompts';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const EASING_CURVE = Easing.bezier(0.25, 0.1, 0.25, 1);

interface Props {
  visible: boolean;
  prompt: OpenClawPrompt | null;
  onClose: () => void;
}

export default function PromptDetailModal({ visible, prompt, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : SCREEN_HEIGHT, {
      duration: TIMING.ANIMATION_DURATION_MS,
      easing: EASING_CURVE,
    });
    backdropOpacity.value = withTiming(visible ? 1 : 0, {
      duration: TIMING.ANIMATION_DURATION_MS,
      easing: EASING_CURVE,
    });
    if (visible) setCopied(false);
  }, [visible]);

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleCopy = async () => {
    if (!prompt) return;
    await Clipboard.setStringAsync(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!visible && backdropOpacity.value === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[s.modal, modalStyle]}>
        <View style={s.header}>
          <Pressable onPress={onClose} hitSlop={8} style={s.backButton}>
            <ArrowLeft size={20} color={colors.foreground} />
          </Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>
            {prompt?.title ?? 'Prompt'}
          </Text>
          <Pressable onPress={handleCopy} hitSlop={8}>
            {copied ? (
              <Check size={20} color={colors.primary} />
            ) : (
              <Copy size={20} color={colors.primary} />
            )}
          </Pressable>
        </View>

        <ScrollView style={s.scrollContent} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.codeBlock}>
            <Text style={s.codeText}>{prompt?.prompt}</Text>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  codeBlock: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 14,
  },
  codeText: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#374151',
    lineHeight: 20,
  },
});
