import { Platform } from 'react-native';
import { AppConfig } from '../config/appConfig';

let configured = false;

async function getGoogleSignin() {
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  return GoogleSignin;
}

async function ensureConfigured() {
  if (configured) return;
  const GoogleSignin = await getGoogleSignin();
  GoogleSignin.configure({
    webClientId: AppConfig.googleClientId,
    iosClientId: AppConfig.googleClientIdIos,
    offlineAccess: true,
  });
  configured = true;
}

export interface GoogleUserInfo {
  email: string;
  name: string;
  google_id: string;
  avatar_url: string;
}

export type GoogleSignInResult =
  | { type: 'token'; idToken: string }
  | { type: 'userInfo'; userInfo: GoogleUserInfo };

// --- Web: Google Identity Services ---

let gisLoaded = false;
let tokenClient: any = null;

function loadGisScript(): Promise<void> {
  if (gisLoaded && (window as any).google?.accounts) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

function googleSignInWeb(): Promise<GoogleSignInResult> {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGisScript();
      const google = (window as any).google;

      // Use OAuth token flow directly (works reliably on all origins)
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: AppConfig.googleClientId,
        scope: 'email profile',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error));
            return;
          }
          if (tokenResponse.access_token) {
            try {
              const resp = await fetch(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                { headers: { Authorization: 'Bearer ' + tokenResponse.access_token } },
              );
              const userInfo = await resp.json();
              resolve({
                type: 'userInfo',
                userInfo: {
                  email: userInfo.email,
                  name: userInfo.name || '',
                  google_id: userInfo.id || '',
                  avatar_url: userInfo.picture || '',
                },
              });
            } catch {
              reject(new Error('Failed to fetch Google user info'));
            }
          } else {
            reject(new Error('Google OAuth failed'));
          }
        },
      });

      // Request access token - opens Google popup directly from user click context
      tokenClient.requestAccessToken();
    } catch (e) {
      reject(e);
    }
  });
}

// --- Public API ---

export async function googleSignIn(): Promise<GoogleSignInResult> {
  if (Platform.OS === 'web') {
    return googleSignInWeb();
  }

  await ensureConfigured();
  const GoogleSignin = await getGoogleSignin();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;
  if (!idToken) {
    throw new Error('Failed to obtain Google ID token');
  }
  return { type: 'token', idToken };
}

export async function googleSignOut(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const GoogleSignin = await getGoogleSignin();
    await GoogleSignin.signOut();
  } catch {
    // Google sign-out failure is non-critical.
  }
}
