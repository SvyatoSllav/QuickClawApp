import React, { useEffect, useRef } from 'react';
import { View, Text, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

function MarqueeChip({ label }: { label: string }) {
  return (
    <View className="mx-1 px-4 py-2.5 bg-[#111114] rounded-xl border border-white/10">
      <Text className="text-zinc-300 text-sm font-medium">{label}</Text>
    </View>
  );
}

function MarqueeRow({ items, duration, reverse }: { items: string[]; duration: number; reverse?: boolean }) {
  const progress = useSharedValue(0);
  const scrollDist = useSharedValue(0);
  const measured = useRef(false);
  const contentRef = useRef<any>(null);

  // Start the 0→1 animation immediately (original approach that works on web)
  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: duration * 1000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress, duration]);

  // Measure content width after mount (no state change = no re-render)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const timer = setTimeout(() => {
      if (measured.current || !contentRef.current) return;
      const node = contentRef.current;
      const el = node.unstable_domNode ?? node;
      if (el && typeof el.scrollWidth === 'number' && el.scrollWidth > 0) {
        scrollDist.value = el.scrollWidth / 2;
        measured.current = true;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [scrollDist]);

  // For native: measure via onLayout
  const onLayout = (e: any) => {
    if (measured.current) return;
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      scrollDist.value = w / 2;
      measured.current = true;
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const dist = scrollDist.value || 500; // fallback
    if (reverse) {
      // Reverse: start at -dist, animate toward 0
      return { transform: [{ translateX: -dist + progress.value * dist }] };
    }
    // Forward: start at 0, animate toward -dist
    return { transform: [{ translateX: -progress.value * dist }] };
  });

  return (
    <View className="h-11 overflow-hidden my-1">
      <Animated.View
        ref={contentRef}
        style={[{ flexDirection: 'row' }, animatedStyle]}
        onLayout={onLayout}
      >
        {[...items, ...items].map((label, i) => (
          <MarqueeChip key={`${label}-${i}`} label={label} />
        ))}
      </Animated.View>
    </View>
  );
}

export default function MarqueeSection() {
  const { t } = useTranslation();

  const marqueeRows: string[][] = [
    t('marqueeRow1', { returnObjects: true }) as string[],
    t('marqueeRow2', { returnObjects: true }) as string[],
    t('marqueeRow3', { returnObjects: true }) as string[],
    t('marqueeRow4', { returnObjects: true }) as string[],
  ];

  return (
    <View className="py-10">
      <View className="px-4">
        <Text className="text-white text-2xl font-medium text-center">
          {t('useCasesTitle')}
        </Text>
        <View className="h-1" />
        <Text className="text-2xl font-medium text-center" style={{ color: '#6A6B6C' }}>
          {t('useCasesSubtitle')}
        </Text>
      </View>
      <View className="h-8" />
      <View>
        {marqueeRows.map((items, index) => (
          <MarqueeRow
            key={index}
            items={items}
            duration={38 + index * 2}
            reverse={index % 2 === 1}
          />
        ))}
      </View>
    </View>
  );
}
