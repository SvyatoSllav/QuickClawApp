import React, { useEffect } from 'react';
import { View, Pressable, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { User, Lightbulb, Plug, ShoppingBag, FileText, X } from 'lucide-react-native';
import { useNavigationStore, AppScreen } from '../../stores/navigationStore';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.82;
const ANIM_DURATION = 280;
const EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

interface MenuItem {
  label: string;
  icon: typeof User;
  screen: AppScreen;
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Profile', icon: User, screen: 'profile' },
  { label: 'Use Cases', icon: Lightbulb, screen: 'useCases' },
  { label: 'Integrations', icon: Plug, screen: 'profile' },
  { label: 'Marketplace', icon: ShoppingBag, screen: 'marketplace' },
  { label: 'System Prompts', icon: FileText, screen: 'systemPrompts' },
];

export default function Sidebar() {
  const isSidebarOpen = useNavigationStore((s) => s.isSidebarOpen);
  const closeSidebar = useNavigationStore((s) => s.closeSidebar);
  const setScreen = useNavigationStore((s) => s.setScreen);

  const translateX = useSharedValue(-SIDEBAR_WIDTH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withTiming(isSidebarOpen ? 0 : -SIDEBAR_WIDTH, {
      duration: ANIM_DURATION,
      easing: EASING,
    });
    backdropOpacity.value = withTiming(isSidebarOpen ? 1 : 0, {
      duration: ANIM_DURATION,
      easing: EASING,
    });
  }, [isSidebarOpen]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={isSidebarOpen ? 'auto' : 'none'}
    >
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          onPress={closeSidebar}
        />
      </Animated.View>

      {/* Sidebar panel */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: SIDEBAR_WIDTH,
            backgroundColor: '#0a0b0d',
            borderRightWidth: 1,
            borderRightColor: '#1e1e22',
          },
          sidebarStyle,
        ]}
      >
        {/* Header with close button */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
          <Text className="text-lg font-bold text-foreground">Menu</Text>
          <Pressable onPress={closeSidebar} hitSlop={12}>
            <X size={22} color="#a1a1aa" />
          </Pressable>
        </View>

        {/* Menu items */}
        <View className="px-3 pt-2">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.label}
                onPress={() => setScreen(item.screen)}
                className="flex-row items-center gap-4 px-3 py-3.5 rounded-lg active:bg-accent"
              >
                <Icon size={20} color="#a1a1aa" />
                <Text className="text-base font-medium text-foreground">
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}
