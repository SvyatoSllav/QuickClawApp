import React, { useEffect } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../config/colors';

export default function AuthScreen() {
  const { t } = useTranslation();
  const signInApple = useAuthStore((s) => s.signInApple);
  const signInGoogle = useAuthStore((s) => s.signInGoogle);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  return (
    <View style={styles.container}>
      <Text variant="h3" className="text-center mb-2" style={{ color: colors.foreground }}>
        {t('signInTitle')}
      </Text>
      <Text variant="muted" className="text-center mb-10">
        {t('signInSubtitle')}
      </Text>

      {Platform.OS === 'ios' && (
        <Button
          onPress={signInApple}
          disabled={loading}
          className="w-full mb-3"
          variant="outline"
          style={styles.appleButton}
        >
          <Text style={styles.appleButtonText}>
            {loading ? t('signingIn') : t('signInWithApple')}
          </Text>
        </Button>
      )}

      <Button
        onPress={signInGoogle}
        disabled={loading}
        className="w-full"
        style={styles.googleButton}
      >
        <Text style={styles.googleButtonText}>
          {loading ? t('signingIn') : t('signInWithGoogle')}
        </Text>
      </Button>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  appleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.border,
    borderWidth: 1,
  },
  appleButtonText: {
    color: colors.foreground,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: colors.primary,
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorText: {
    color: colors.destructive,
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
  },
});
