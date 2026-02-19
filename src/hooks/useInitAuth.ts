import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useOnboardingStore } from '../stores/onboardingStore';

export function useInitAuth() {
  const authInit = useAuthStore((s) => s.init);
  const checkOnboarding = useOnboardingStore((s) => s.checkOnboarding);

  useEffect(() => {
    async function bootstrap() {
      await checkOnboarding();
      await authInit();
    }
    bootstrap();
  }, [authInit, checkOnboarding]);
}
