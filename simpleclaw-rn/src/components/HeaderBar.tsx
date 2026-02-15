import React, { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { AppConfig } from '../config/appConfig';
import { useAuthStore } from '../stores/authStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useLanguageStore } from '../stores/languageStore';

export default function HeaderBar() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const setScreen = useNavigationStore((s) => s.setScreen);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View className="flex-row items-center px-2 py-2">
      <Pressable onPress={() => setScreen('landing')}>
        <Text className="text-white font-medium text-base">
          SimpleClaw.com
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setLanguage(language === 'en' ? 'ru' : 'en')}
        className="ml-2 flex-row"
      >
        <Text className={language === 'en' ? 'text-white text-sm font-medium' : 'text-zinc-500 text-sm'}>EN</Text>
        <Text className="text-zinc-600 text-sm mx-0.5">/</Text>
        <Text className={language === 'ru' ? 'text-white text-sm font-medium' : 'text-zinc-500 text-sm'}>RU</Text>
      </Pressable>

      <View className="flex-1" />

      <Pressable
        className="flex-row items-center"
        onPress={() => Linking.openURL(`mailto:${AppConfig.supportEmail}`)}
      >
        <Text className="text-zinc-400 text-sm">{t('support')}</Text>
      </Pressable>

      {isAuthenticated && (
        <View className="ml-3">
          <Pressable
            onPress={() => setMenuVisible(true)}
            className="w-9 h-9 rounded-full bg-zinc-800 items-center justify-center"
          >
            <Text className="text-zinc-400 text-lg">👤</Text>
          </Pressable>

          <Modal
            visible={menuVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setMenuVisible(false)}
          >
            <Pressable
              className="flex-1"
              onPress={() => setMenuVisible(false)}
            >
              <View className="absolute right-4 top-16 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden min-w-[140px]">
                <Pressable
                  className="px-4 py-3"
                  onPress={() => {
                    setMenuVisible(false);
                    setScreen('profile');
                  }}
                >
                  <Text className="text-zinc-300 text-sm">{t('profile')}</Text>
                </Pressable>
                <View className="h-px bg-zinc-700" />
                <Pressable
                  className="px-4 py-3"
                  onPress={() => {
                    setMenuVisible(false);
                    logout();
                    setScreen('landing');
                  }}
                >
                  <Text className="text-zinc-300 text-sm">{t('logout')}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Modal>
        </View>
      )}
    </View>
  );
}
