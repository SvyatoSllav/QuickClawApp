import React from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import HeaderBar from '../components/HeaderBar';
import { useNavigationStore } from '../stores/navigationStore';
import { colors } from '../config/colors';

export default function ActiveSubscriptionScreen() {
  const { t } = useTranslation();
  const setScreen = useNavigationStore((s) => s.setScreen);

  return (
    <ScrollView>
      <View style={{ maxWidth: 600, width: '100%', alignSelf: 'center' }}>
        <HeaderBar />
        <View className="px-4 pt-16 pb-10 items-center">
          {/* Check icon */}
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 48, color: colors.emerald400 }}>✓</Text>
          </View>

          <View className="h-6" />
          <Text className="text-white text-3xl font-bold text-center">
            {t('openclawActive')}
          </Text>
          <View className="h-2" />
          <Text className="text-zinc-300 text-base text-center">
            {t('openclawActiveDesc')}
          </Text>
          <View className="h-8" />
          <Pressable
            onPress={() => setScreen('profile')}
            className="bg-zinc-800 px-6 py-3.5 rounded-xl"
          >
            <Text className="text-white text-base font-medium">
              {t('openProfile')}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
