import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../src/i18n';
import '../global.css';

SplashScreen.preventAutoHideAsync();

function useWebFonts() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `
      html, body, #root, [dir="auto"] {
        font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
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
    Inter: Inter_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
