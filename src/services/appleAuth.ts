import { Platform } from 'react-native';

export interface AppleAuthResult {
  identityToken: string;
  fullName: string | null;
}

export async function appleSignIn(): Promise<AppleAuthResult> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only available on iOS.');
  }

  const AppleAuthentication = await import('expo-apple-authentication');

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Failed to obtain Apple identity token');
  }

  let fullName: string | null = null;
  if (credential.fullName) {
    const parts = [
      credential.fullName.givenName,
      credential.fullName.familyName,
    ].filter(Boolean);
    if (parts.length > 0) {
      fullName = parts.join(' ');
    }
  }

  return {
    identityToken: credential.identityToken,
    fullName,
  };
}

