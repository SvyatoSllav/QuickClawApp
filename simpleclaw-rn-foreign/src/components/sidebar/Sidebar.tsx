import React, { useEffect } from 'react';
import { View, Pressable, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
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

const SCREEN_WIDTH = Dimensions.get('window').width;
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.82;
const ANIM_DURATION = 280;
const EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

interface MenuItem {
  label: string;
  icon: typeof MessageSquare;
  screen?: AppScreen;
  badge?: number;
}

export default function Sidebar() {
  const isSidebarOpen = useNavigationStore((s) => s.isSidebarOpen);
  const closeSidebar = useNavigationStore((s) => s.closeSidebar);
  const setScreen = useNavigationStore((s) => s.setScreen);
  const currentScreen = useNavigationStore((s) => s.screen);
  const sessions = useSessionStore((s) => s.sessions);

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

  const mainItems: MenuItem[] = [
    { label: '\u0421\u0435\u0441\u0441\u0438\u0438', icon: MessageSquare, screen: 'chat', badge: sessions.length > 0 ? sessions.length : undefined },
    { label: '\u0410\u0433\u0435\u043D\u0442\u044B', icon: Users, screen: 'agents' },
    { label: '\u041D\u0430\u0432\u044B\u043A\u0438', icon: Sparkles, screen: 'skills' },
    { label: '\u0424\u0430\u0439\u043B\u044B', icon: FolderOpen, screen: 'files' },
  ];

  const managementItems: MenuItem[] = [
    { label: '\u0418\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0438', icon: Link, screen: 'profile' },
    { label: '\u0410\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0430', icon: BarChart3 },
    { label: '\u0421\u0435\u0440\u0432\u0435\u0440', icon: Server },
    { label: '\u041E\u0431\u0443\u0447\u0435\u043D\u0438\u0435', icon: BookOpen },
    { label: '\u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430', icon: HelpCircle },
  ];

  const renderItem = (item: MenuItem, isActive: boolean) => {
    const Icon = item.icon;
    return (
      <Pressable
        key={item.label}
        onPress={() => {
          if (item.screen) setScreen(item.screen);
        }}
        style={[
          styles.menuItem,
          isActive && styles.menuItemActive,
        ]}
      >
        <Icon size={20} color={isActive ? colors.primary : '#6B7280'} />
        <Text
          style={[
            styles.menuLabel,
            isActive && styles.menuLabelActive,
          ]}
        >
          {item.label}
        </Text>
        {item.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
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
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={{ fontSize: 22 }}>{'\uD83E\uDD80'}</Text>
            <Text style={styles.headerTitle}>EasyClaw</Text>
          </View>
          <Pressable onPress={closeSidebar} hitSlop={12}>
            <X size={22} color="#6B7280" />
          </Pressable>
        </View>

        {/* Main menu */}
        <View style={styles.menuSection}>
          {mainItems.map((item) => {
            const isActive = item.screen === currentScreen;
            return renderItem(item, isActive);
          })}
        </View>

        {/* Separator + Management */}
        <View style={styles.separator} />
        <Text style={styles.sectionHeader}>{'\u0423\u041F\u0420\u0410\u0412\u041B\u0415\u041D\u0418\u0415'}</Text>
        <View style={styles.menuSection}>
          {managementItems.map((item) => renderItem(item, false))}
        </View>

        {/* Bottom */}
        <View style={styles.bottomSection}>
          <Pressable
            onPress={() => setScreen('profile')}
            style={styles.settingsButton}
          >
            <Settings size={20} color="#6B7280" />
          </Pressable>

          <View style={styles.planCard}>
            <Text style={styles.planLabel}>
              {'\u041F\u043B\u0430\u043D: '}<Text style={styles.planBold}>Free</Text>
            </Text>
            <Text style={styles.planTokens}>12,400 {'\u0442\u043E\u043A\u0435\u043D\u043E\u0432 \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C'}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: '#1A1A1A',
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
    backgroundColor: '#FEF3C7',
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
    backgroundColor: '#FEF3C7',
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
