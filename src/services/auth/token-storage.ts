import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { AuthTokens } from '@/features/auth/types';
import { registerAccessTokenProvider } from '@/services/api/client';

const ACCESS_TOKEN_KEY = 'auth.accessToken';
const REFRESH_TOKEN_KEY = 'auth.refreshToken';
const BIOMETRIC_TOKEN_KEY = 'auth.biometricCredential';
const BIOMETRIC_ENABLED_KEY = 'auth.biometricEnabled';

const biometricSecureOptions: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Unlock Sagawa',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function getStoredTokens(): Promise<AuthTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
  };
}

export async function saveTokens(tokens: AuthTokens) {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

export function initializeTokenStorage() {
  registerAccessTokenProvider(async () => {
    const tokens = await getStoredTokens();
    return tokens?.accessToken ?? null;
  });
}


export async function hasBiometricCredential() {
  return (await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY)) === '1';
}

export async function saveBiometricCredential(credential: string) {
  await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, credential, biometricSecureOptions);
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, '1');
}

export async function getBiometricCredential() {
  if (!(await hasBiometricCredential())) return null;
  return SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY, biometricSecureOptions);
}

export async function clearBiometricCredential() {
  await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
  await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
}
