import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStore } from '../src/stores/navigationStore';
import { useAuthStore } from '../src/stores/authStore';
import { useOnboardingStore } from '../src/stores/onboardingStore';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';
import { useInitAuth } from '../src/hooks/useInitAuth';
import OnboardingScreen from '../src/screens/OnboardingScreen';
import AuthScreen from '../src/screens/AuthScreen';
import PlanScreen from '../src/screens/PlanScreen';
import ChatScreen from '../src/screens/ChatScreen';
import ProfileScreen from '../src/screens/ProfileScreen';
import AgentsScreen from '../src/screens/AgentsScreen';
import SkillsScreen from '../src/screens/SkillsScreen';
import FilesScreen from '../src/screens/FilesScreen';
import Sidebar from '../src/components/sidebar/Sidebar';
import SessionDrawer from '../src/components/chat/SessionDrawer';
import { colors } from '../src/config/colors';

export default function MainScreen() {
  useInitAuth();

  const screen = useNavigationStore((s) => s.screen);
  const setScreen = useNavigationStore((s) => s.setScreen);
  const isSessionDrawerOpen = useNavigationStore((s) => s.isSessionDrawerOpen);
  const closeSessionDrawer = useNavigationStore((s) => s.closeSessionDrawer);
  const initComplete = useAuthStore((s) => s.initComplete);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasOnboarded = useOnboardingStore((s) => s.hasCompletedOnboarding);
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);

  useEffect(() => {
    if (!initComplete) return;

    if (!hasOnboarded && !isAuthenticated) {
      setScreen('onboarding');
    } else if (!isAuthenticated) {
      setScreen('auth');
    } else if (!isSubscribed) {
      setScreen('plan');
    } else {
      setScreen('chat');
    }
  }, [initComplete, hasOnboarded, isAuthenticated, isSubscribed, setScreen]);

  if (!initComplete) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const renderScreen = () => {
    switch (screen) {
      case 'onboarding':
        return <OnboardingScreen />;
      case 'auth':
        return <AuthScreen />;
      case 'plan':
        return <PlanScreen />;
      case 'chat':
        return <ChatScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'agents':
        return <AgentsScreen />;
      case 'skills':
        return <SkillsScreen />;
      case 'files':
        return <FilesScreen />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {renderScreen()}
      <SessionDrawer visible={isSessionDrawerOpen} onClose={closeSessionDrawer} />
      <Sidebar />
    </SafeAreaView>
  );
}
