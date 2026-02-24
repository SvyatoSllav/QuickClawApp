import React, { useEffect } from 'react';
import { View, Pressable, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import {
  MessageSquare,
  Users,
  Sparkles,
  FolderOpen,
  Link,
  BarChart3,
  Server,
  BookOpen,
  HelpCircle,
  Settings,
  X,
} from 'lucide-react-native';
import { useNavigationStore, AppScreen } from '../../stores/navigationStore';
import { useSessionStore } from '../../stores/sessionStore';
import { colors } from '../../config/colors';
import { TIMING } from '../../config/constants';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.82;
const EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

interface MenuItem {
  label: string;
  icon: typeof MessageSquare;
  screen?: AppScreen;
  badge?: number;
  disabled?: boolean;
}

export default function Sidebar() {
  const insets = useSafeAreaInsets();
  const isSidebarOpen = useNavigationStore((s) => s.isSidebarOpen);
  const closeSidebar = useNavigationStore((s) => s.closeSidebar);
  const setScreen = useNavigationStore((s) => s.setScreen);
  const currentScreen = useNavigationStore((s) => s.screen);
  const sessions = useSessionStore((s) => s.sessions);

  const translateX = useSharedValue(-SIDEBAR_WIDTH);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withTiming(isSidebarOpen ? 0 : -SIDEBAR_WIDTH, {
      duration: TIMING.ANIMATION_DURATION_MS,
      easing: EASING,
    });
    backdropOpacity.value = withTiming(isSidebarOpen ? 1 : 0, {
      duration: TIMING.ANIMATION_DURATION_MS,
      easing: EASING,
    });
  }, [isSidebarOpen]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const mainItems: MenuItem[] = [
    { label: 'Sessions', icon: MessageSquare, screen: 'chat', badge: sessions.length > 0 ? sessions.length : undefined },
    { label: 'Agents', icon: Users, screen: 'agents' },
    { label: 'Skills', icon: Sparkles, screen: 'skills' },
    { label: 'Files', icon: FolderOpen, screen: 'files' },
  ];

  const managementItems: MenuItem[] = [
    { label: 'Integrations', icon: Link, screen: 'profile' },
    { label: 'Knowledge Base', icon: BookOpen, screen: 'knowledgebase' },
    { label: 'Analytics', icon: BarChart3, disabled: true },
    { label: 'Server', icon: Server, disabled: true },
    { label: 'Support', icon: HelpCircle, screen: 'support' },
  ];

  const renderItem = (item: MenuItem, isActive: boolean) => {
    const Icon = item.icon;

    if (item.disabled) {
      return (
        <View key={item.label} style={[localStyles.menuItem, { opacity: 0.4 }]}>
          <Icon size={20} color="#6B7280" />
          <Text style={localStyles.menuLabel}>{item.label}</Text>
          <View style={localStyles.comingSoonBadge}>
            <Text style={localStyles.comingSoonText}>Soon</Text>
          </View>
        </View>
      );
    }

    return (
      <Pressable
        key={item.label}
        onPress={() => {
          if (item.screen) setScreen(item.screen);
        }}
        style={[
          localStyles.menuItem,
          isActive && localStyles.menuItemActive,
        ]}
      >
        <Icon size={20} color={isActive ? colors.primary : '#6B7280'} />
        <Text
          style={[
            localStyles.menuLabel,
            isActive && localStyles.menuLabelActive,
          ]}
        >
          {item.label}
        </Text>
        {item.badge && (
          <View style={localStyles.badge}>
            <Text style={localStyles.badgeText}>{item.badge}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={isSidebarOpen ? 'auto' : 'none'}
    >
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
          onPress={closeSidebar}
        />
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: SIDEBAR_WIDTH,
            backgroundColor: colors.background,
            borderRightWidth: 1,
            borderRightColor: colors.border,
          },
          sidebarStyle,
        ]}
      >
        {/* Header */}
        <View style={[localStyles.header, { paddingTop: insets.top + 12 }]}>
          <View style={localStyles.headerLeft}>
            <Text style={{ fontSize: 22 }}>{'\uD83E\uDD80'}</Text>
            <Text style={localStyles.headerTitle}>EasyClaw</Text>
          </View>
          <Pressable onPress={closeSidebar} hitSlop={12}>
            <X size={22} color="#6B7280" />
          </Pressable>
        </View>

        {/* Main menu */}
        <View style={localStyles.menuSection}>
          {mainItems.map((item) => {
            const isActive = item.screen === currentScreen;
            return renderItem(item, isActive);
          })}
        </View>

        {/* Separator + Management */}
        <View style={localStyles.separator} />
        <Text style={localStyles.sectionHeader}>MANAGEMENT</Text>
        <View style={localStyles.menuSection}>
          {managementItems.map((item) => renderItem(item, false))}
        </View>

        {/* Bottom */}
        <View style={localStyles.bottomSection}>
          <Pressable
            onPress={() => setScreen('profile')}
            style={localStyles.settingsButton}
          >
            <Settings size={20} color="#6B7280" />
          </Pressable>

          <View style={localStyles.planCard}>
            <Text style={localStyles.planLabel}>
              Plan: <Text style={localStyles.planBold}>Free</Text>
            </Text>
            <Text style={localStyles.planTokens}>12,400 tokens remaining</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  menuSection: {
    paddingHorizontal: 12,
    gap: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
  },
  menuItemActive: {
    backgroundColor: colors.accent,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  menuLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  comingSoonBadge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
    marginVertical: 8,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    paddingHorizontal: 26,
    paddingVertical: 8,
  },
  bottomSection: {
    marginTop: 'auto',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  settingsButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 8,
  },
  planCard: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  planLabel: {
    fontSize: 14,
    color: '#374151',
  },
  planBold: {
    fontWeight: '700',
  },
  planTokens: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
});
