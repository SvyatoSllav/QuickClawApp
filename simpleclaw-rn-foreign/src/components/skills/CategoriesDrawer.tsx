import React, { useEffect } from 'react';
import { View, Pressable, Dimensions, StyleSheet, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import {
  X,
  Wrench,
  Code,
  Briefcase,
  BrainCircuit,
  Container,
  ShieldCheck,
  FileText,
  Image,
  FlaskConical,
  Database,
  Heart,
  Link,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { SKILL_CATEGORIES, SkillCategory } from '../../api/skillsmpApi';
import { colors } from '../../config/colors';

const ICON_MAP: Record<string, LucideIcon> = {
  Wrench,
  Code,
  Briefcase,
  BrainCircuit,
  Container,
  ShieldCheck,
  FileText,
  Image,
  FlaskConical,
  Database,
  Heart,
  Link,
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.82;
const ANIM_DURATION = 280;
const EASING_CURVE = Easing.bezier(0.25, 0.1, 0.25, 1);

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (category: SkillCategory) => void;
  activeCategory: string | null;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

export default function CategoriesDrawer({ visible, onClose, onSelect, activeCategory }: Props) {
  const translateX = useSharedValue(DRAWER_WIDTH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withTiming(visible ? 0 : DRAWER_WIDTH, {
      duration: ANIM_DURATION,
      easing: EASING_CURVE,
    });
    backdropOpacity.value = withTiming(visible ? 1 : 0, {
      duration: ANIM_DURATION,
      easing: EASING_CURVE,
    });
  }, [visible]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
          onPress={onClose}
        />
      </Animated.View>

      <Animated.View style={[localStyles.drawer, drawerStyle]}>
        <View style={localStyles.header}>
          <Text style={localStyles.headerTitle}>Categories</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color="#6B7280" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {SKILL_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            const Icon = ICON_MAP[cat.icon];
            return (
              <Pressable
                key={cat.key}
                onPress={() => {
                  onSelect(cat);
                  onClose();
                }}
                style={[
                  localStyles.categoryItem,
                  isActive && localStyles.categoryItemActive,
                ]}
              >
                <View style={localStyles.categoryLeft}>
                  {Icon && (
                    <Icon
                      size={18}
                      color={isActive ? colors.primary : '#6B7280'}
                    />
                  )}
                  <Text
                    style={[
                      localStyles.categoryLabel,
                      isActive && localStyles.categoryLabelActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </View>
                <Text style={localStyles.categoryCount}>
                  {formatCount(cat.count)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.background,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8DC',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryItemActive: {
    backgroundColor: '#FEF3C7',
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  categoryLabelActive: {
    fontWeight: '700',
    color: colors.primary,
  },
  categoryCount: {
    fontSize: 13,
    color: '#8B8B8B',
    fontWeight: '500',
  },
});
