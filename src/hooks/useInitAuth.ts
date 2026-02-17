import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useOnboardingStore } from '../stores/onboardingStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { useDeployStore } from '../stores/deployStore';
import { useChatStore } from '../stores/chatStore';
import { useUsageStore } from '../stores/usageStore';

export function useInitAuth() {
  const authInit = useAuthStore((s) => s.init);
  const checkOnboarding = useOnboardingStore((s) => s.checkOnboarding);

  useEffect(() => {
    async function bootstrap() {
      // Web dev mock — bypass auth/subscription but let onboarding work normally
      if (Platform.OS === 'web' && __DEV__) {
        await checkOnboarding();
        const hasOnboarded = useOnboardingStore.getState().hasCompletedOnboarding;

        useAuthStore.setState({
          isAuthenticated: hasOnboarded,
          authToken: hasOnboarded ? 'mock-token' : null,
          user: hasOnboarded
            ? { id: 1, email: 'demo@simpleclaw.com', firstName: 'Demo', lastName: 'User', profile: null }
            : null,
          loading: false,
          error: null,
          initComplete: true,
        });
        if (hasOnboarded) {
          useSubscriptionStore.setState({ isSubscribed: true });
          useChatStore.setState({
            connectionState: 'connected',
            messages: [
              { id: 'mock-1', role: 'user', content: 'Hello, what can you do?', timestamp: Date.now() - 60000 },
              { id: 'mock-2', role: 'assistant', content: 'I can help you with marketing campaigns, business analytics, content creation, and much more. What would you like to work on?', timestamp: Date.now() - 50000 },
              { id: 'mock-3', role: 'user', content: 'Analyze my Q4 revenue data and create a report.', timestamp: Date.now() - 30000 },
              { id: 'mock-4', role: 'assistant', content: 'I\'ll analyze your Q4 revenue data now. Give me a moment to pull the numbers and generate insights for the report.', timestamp: Date.now() - 20000 },
            ],
          });
        }
        return;
      }

      await checkOnboarding();
      await authInit();
    }
    bootstrap();
  }, [authInit, checkOnboarding]);
}
