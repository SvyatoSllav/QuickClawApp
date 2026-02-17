import React, { useRef, useCallback } from 'react';
import { View, FlatList, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import OnboardingPage from '../components/onboarding/OnboardingPage';
import PageIndicator from '../components/onboarding/PageIndicator';
import { useOnboardingStore } from '../stores/onboardingStore';
import { useNavigationStore } from '../stores/navigationStore';

const { width } = Dimensions.get('window');

const PAGES = [
  { index: '01', titleKey: 'onboardingTitle1', descKey: 'onboardingDesc1' },
  { index: '02', titleKey: 'onboardingTitle2', descKey: 'onboardingDesc2' },
  { index: '03', titleKey: 'onboardingTitle3', descKey: 'onboardingDesc3' },
] as const;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const flatListRef = useRef<FlatList>(null);
  const currentPage = useOnboardingStore((s) => s.currentPage);
  const setScreen = useNavigationStore((s) => s.setScreen);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const handleGetStarted = useCallback(async () => {
    await completeOnboarding();
    setScreen('auth');
  }, [completeOnboarding, setScreen]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / width);
      useOnboardingStore.getState().setCurrentPage(page);
    },
    [],
  );

  return (
    <View className="flex-1 bg-background">
      <FlatList
        ref={flatListRef}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <OnboardingPage
            index={item.index}
            title={t(item.titleKey)}
            description={t(item.descKey)}
          />
        )}
      />

      <View className="px-6 pb-8 gap-4">
        <PageIndicator total={PAGES.length} current={currentPage} />

        <Button onPress={handleGetStarted} className="w-full">
          <Text className="font-semibold">{t('getStarted', 'Get Started')}</Text>
        </Button>
      </View>
    </View>
  );
}
