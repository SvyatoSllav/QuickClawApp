import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStore } from '../src/stores/navigationStore';
import { useAuthStore } from '../src/stores/authStore';
import { useOnboardingStore } from '../src/stores/onboardingStore';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';
import { useDeployStore } from '../src/stores/deployStore';
import { useChatStore } from '../src/stores/chatStore';
import { useInitAuth } from '../src/hooks/useInitAuth';
import { remoteLog } from '../src/services/remoteLog';
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
import SpinnerIcon from '../src/components/ui/SpinnerIcon';
import { Text } from '../src/components/ui/text';
import { colors } from '../src/config/colors';

export default function MainScreen() {
  useInitAuth();

  const screen = useNavigationStore((s) => s.screen);
  const setScreen = useNavigationStore((s) => s.setScreen);
  const isSessionDrawerOpen = useNavigationStore((s) => s.isSessionDrawerOpen);
  const closeSessionDrawer = useNavigationStore((s) => s.closeSessionDrawer);
  const initComplete = useAuthStore((s) => s.initComplete);
  const authLoading = useAuthStore((s) => s.loading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasOnboarded = useOnboardingStore((s) => s.hasCompletedOnboarding);
  const isSubscribed = useSubscriptionStore((s) => s.isSubscribed);

  // --- Global WebSocket lifecycle (stays alive across all screens) ---
  const isReady = useDeployStore((s) => s.isReady);
  const ipAddress = useDeployStore((s) => s.ipAddress);
  const gatewayToken = useDeployStore((s) => s.gatewayToken);
  const wsUrl = useDeployStore((s) => s.wsUrl);

  const connRef = useRef({ ipAddress: '', gatewayToken: '', wsUrl: '' });
  useEffect(() => {
    connRef.current = { ipAddress: ipAddress ?? '', gatewayToken: gatewayToken ?? '', wsUrl: wsUrl ?? '' };
  }, [ipAddress, gatewayToken, wsUrl]);

  // Connect when server is ready, disconnect on logout
  useEffect(() => {
    console.log('[main] WS effect: isReady=' + isReady + ' ip=' + connRef.current.ipAddress);
    if (isReady && connRef.current.ipAddress) {
      useChatStore.getState().connect(connRef.current.ipAddress, connRef.current.gatewayToken, connRef.current.wsUrl || undefined);
    }
    return () => {
      if (isReady) {
        console.log('[main] WS cleanup: disconnecting (isReady changed)');
        useChatStore.getState().disconnect();
      }
    };
  }, [isReady]);

  // Reconnect when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const { connectionState: cs, ws: curWs } = useChatStore.getState();
        console.log('[main] AppState → active, ws state:', cs, 'hasWs:', !!curWs);
        remoteLog('info', 'main', 'AppState active', { wsState: cs, hasWs: !!curWs, isReady });
        if (isReady && connRef.current.ipAddress && cs === 'disconnected') {
          console.log('[main] Foreground reconnect triggered');
          remoteLog('info', 'main', 'foreground reconnect');
          useChatStore.getState().connect(connRef.current.ipAddress, connRef.current.gatewayToken, connRef.current.wsUrl || undefined);
        }
      }
    });
    return () => sub.remove();
  }, [isReady]);

  useEffect(() => {
    if (!initComplete || authLoading) return;

    if (!hasOnboarded && !isAuthenticated) {
      setScreen('onboarding');
    } else if (!isAuthenticated) {
      setScreen('auth');
    } else if (!isSubscribed) {
      setScreen('plan');
    } else {
      setScreen('chat');
    }
  }, [initComplete, authLoading, hasOnboarded, isAuthenticated, isSubscribed, setScreen]);

  if (!initComplete || (authLoading && isAuthenticated)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <SpinnerIcon size={40} />
        <Text style={{ fontSize: 15, color: '#8B8B8B', fontWeight: '500' }}>
          {isAuthenticated ? 'Setting up your workspace...' : 'Loading...'}
        </Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      {renderScreen()}
      <SessionDrawer visible={isSessionDrawerOpen} onClose={closeSessionDrawer} />
      <Sidebar />
    </SafeAreaView>
  );
}
