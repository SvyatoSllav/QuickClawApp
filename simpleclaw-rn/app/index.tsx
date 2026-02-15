import React, { useEffect, useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigationStore } from '../src/stores/navigationStore';
import { useTelegramStore } from '../src/stores/telegramStore';
import { useLanguageStore } from '../src/stores/languageStore';
import { useInitAuth } from '../src/hooks/useInitAuth';
import LandingScreen from '../src/screens/LandingScreen';
import SuccessScreen from '../src/screens/SuccessScreen';
import ProfileScreen from '../src/screens/ProfileScreen';
import ActiveSubscriptionScreen from '../src/screens/ActiveSubscriptionScreen';
import TelegramModal from '../src/screens/TelegramModal';

export default function MainScreen() {
  useInitAuth();

  useEffect(() => {
    useLanguageStore.getState().init();
  }, []);

  const screen = useNavigationStore((s) => s.screen);
  const isModalVisible = useTelegramStore((s) => s.isModalVisible);
  const hideModal = useTelegramStore((s) => s.hideModal);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isModalVisible) {
      setShowModal(true);
      hideModal();
    }
  }, [isModalVisible, hideModal]);

  const handleModalDismiss = useCallback(() => {
    setShowModal(false);
  }, []);

  const renderScreen = () => {
    switch (screen) {
      case 'landing':
        return <LandingScreen />;
      case 'success':
        return <SuccessScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'activeSubscription':
        return <ActiveSubscriptionScreen />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#07080A' }}>
      {renderScreen()}
      {showModal && <TelegramModal onDismiss={handleModalDismiss} />}
    </SafeAreaView>
  );
}
