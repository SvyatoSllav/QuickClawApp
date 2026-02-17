import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalHost } from '@rn-primitives/portal';
import '../src/i18n';
import '../global.css';

SplashScreen.preventAutoHideAsync();

function useWebFonts() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `
      html, body, #root, [dir="auto"] {
        font-family: 'Satoshi', system-ui, -apple-system, sans-serif !important;
        -webkit-font-smoothing: antialiased;
      }
    `;
    document.head.appendChild(style);
  }, []);
}

export default function RootLayout() {
  const isWeb = Platform.OS === 'web';

  useWebFonts();

  const [fontsLoaded] = useFonts(isWeb ? {} : {
    'Satoshi-Regular': require('../assets/fonts/Satoshi-Regular.ttf'),
    'Satoshi-Medium': require('../assets/fonts/Satoshi-Medium.ttf'),
    'Satoshi-Bold': require('../assets/fonts/Satoshi-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView className="flex-1 dark">
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
      <PortalHost />
    </GestureHandlerRootView>
  );
}
