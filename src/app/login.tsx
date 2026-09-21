import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import SagawaFlowerLogo from '../../assets/images/sagawa-flower-logo.svg';
import { apiRequest } from '@/services/api/client';
import {
  getBiometricCredential,
  hasBiometricCredential,
} from '@/services/auth/token-storage';
import { useAuthStore } from '@/store/auth-store';

type Channel = 'email' | 'phone';

const LOGIN_BACKGROUND = require('../../assets/images/login-bg.jpg');
const ANDROID_EXTRA_BOLD = Platform.OS === 'android' ? '700' : '800';

export default function LoginScreen() {
  const [stage, setStage] = useState<'login' | 'verify'>('login');
  const [channel, setChannel] = useState<Channel>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [identifierHint, setIdentifierHint] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [googleLoggingIn, setGoogleLoggingIn] = useState(false);
  const [guestContinuing, setGuestContinuing] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoggingIn, setBiometricLoggingIn] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    let active = true;
    void hasBiometricCredential().then((enabled) => {
      if (active) setBiometricAvailable(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  const persistSession = async (data: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    profileCompleted?: boolean;
    user: { id: string; email?: string; phoneNumber?: string };
  }) => {
    await useAuthStore.getState().setSession(
      {
        expiresAt: data.expiresAt,
        profileCompleted: Boolean(data.profileCompleted),
        user: data.user,
      },
      {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      },
    );
    router.replace((data.profileCompleted ? '/(tabs)' : '/complete-profile') as Href);
  };

  const handlePasswordLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email or phone number and password.');
      return;
    }

    try {
      setLoggingIn(true);
      const response = await apiRequest<{
        success: boolean;
        data: {
          authenticated: boolean;
          verificationRequired: boolean;
          challengeId: string;
          identifierHint: string;
          expiresAt: string;
        };
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          accountType: 'mobile',
          platform: Platform.OS,
        }),
      });

      if (!response.data.verificationRequired || !response.data.challengeId) {
        throw new Error('Unable to start two-step verification.');
      }

      setChallengeId(response.data.challengeId);
      setIdentifierHint(response.data.identifierHint);
      setCode('');
      setStage('verify');
    } catch (error) {
      Alert.alert('Sign in failed', error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoggingIn(false);
    }
  };

  const verifyLoginCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert('Invalid code', 'Enter the 6-digit verification code.');
      return;
    }

    try {
      setLoggingIn(true);
      const response = await apiRequest<{
        success: boolean;
        data: {
          accessToken: string;
          refreshToken: string;
          expiresAt: string;
          profileCompleted: boolean;
          user: { id: string; email?: string; phoneNumber?: string };
        };
      }>('/api/auth/login/code/verify', {
        method: 'POST',
        body: JSON.stringify({
          challengeId,
          code: code.trim(),
          platform: Platform.OS,
        }),
      });
      await persistSession(response.data);
    } catch (error) {
      Alert.alert(
        'Verification failed',
        error instanceof Error ? error.message : 'Request a new code and try again.',
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const persistGoogleSession = async (response: {
    success: boolean;
    data?: {
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: string;
      profileCompleted?: boolean;
      user?: { id?: string; email?: string };
    };
    message?: string;
  }) => {
    if (
      !response.success ||
      !response.data?.accessToken ||
      !response.data.refreshToken ||
      !response.data.expiresAt ||
      !response.data.user?.id
    ) {
      throw new Error(response.message || 'Unable to complete Google sign-in.');
    }

    await persistSession({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      expiresAt: response.data.expiresAt,
      profileCompleted: Boolean(response.data.profileCompleted),
      user: {
        id: response.data.user.id,
        email: response.data.user.email,
      },
    });
  };

  const handleNativeGoogleLogin = async () => {
    const configResponse = await apiRequest<{
      success: boolean;
      data?: { webClientId?: string; nonce?: string };
      message?: string;
    }>('/api/auth/google/native-config');

    const webClientId = configResponse.data?.webClientId;
    const nonce = configResponse.data?.nonce;
    if (!configResponse.success || !webClientId || !nonce) {
      throw new Error(configResponse.message || 'Google sign-in is unavailable.');
    }

    const {
      GoogleOneTapSignIn,
      isCancelledResponse,
      isNoSavedCredentialFoundResponse,
      isSuccessResponse,
    } = await import('react-native-nitro-google-signin');

    GoogleOneTapSignIn.configure({
      webClientId,
      nonce,
      autoSelectOnSignIn: false,
    });

    await GoogleOneTapSignIn.checkPlayServices();

    let googleResponse = await GoogleOneTapSignIn.createAccount();
    if (isNoSavedCredentialFoundResponse(googleResponse)) {
      googleResponse = await GoogleOneTapSignIn.presentExplicitSignIn();
    }
    if (isCancelledResponse(googleResponse)) return;
    if (!isSuccessResponse(googleResponse) || !googleResponse.data.idToken) {
      throw new Error('Google account selection did not complete.');
    }

    const response = await apiRequest<{
      success: boolean;
      data?: {
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: string;
        profileCompleted?: boolean;
        user?: { id?: string; email?: string };
      };
      message?: string;
    }>('/api/auth/google/native', {
      method: 'POST',
      body: JSON.stringify({
        idToken: googleResponse.data.idToken,
        nonce,
        platform: Platform.OS,
      }),
    });

    await persistGoogleSession(response);
  };

  const handleBrowserGoogleLogin = async () => {
    const startResponse = await apiRequest<{
      success: boolean;
      data?: { authorizationUrl?: string };
      message?: string;
    }>('/api/auth/google/start');

    const authorizationUrl = startResponse.data?.authorizationUrl;
    if (!startResponse.success || !authorizationUrl) {
      throw new Error(startResponse.message || 'Google sign-in is unavailable.');
    }

    const redirectUri = Linking.createURL('auth/google');
    const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirectUri);
    if (result.type === 'cancel' || result.type === 'dismiss') return;
    if (result.type !== 'success' || !result.url) {
      throw new Error('Google sign-in could not be completed.');
    }

    const parsed = Linking.parse(result.url);
    const query = parsed.queryParams ?? {};
    const errorCode = typeof query.error === 'string' ? query.error : '';
    const errorDescription =
      typeof query.error_description === 'string' ? query.error_description : '';
    if (errorCode) throw new Error(errorDescription || 'Google sign-in failed.');

    const authCode = typeof query.code === 'string' ? query.code : '';
    if (!authCode) throw new Error('Google sign-in response is missing the authorization code.');

    const response = await apiRequest<{
      success: boolean;
      data?: {
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: string;
        profileCompleted?: boolean;
        user?: { id?: string; email?: string };
      };
      message?: string;
    }>('/api/auth/google/exchange', {
      method: 'POST',
      body: JSON.stringify({ code: authCode, platform: Platform.OS }),
    });

    await persistGoogleSession(response);
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoggingIn(true);
      if (Platform.OS === 'android') {
        await handleNativeGoogleLogin();
      } else {
        await handleBrowserGoogleLogin();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in with Google.';
      Alert.alert(
        'Google sign in failed',
        message.includes('NitroGoogleSignin')
          ? 'Native Google Sign-In is not installed in this build. Rebuild Sagawa for Android.'
          : message,
      );
    } finally {
      setGoogleLoggingIn(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      setBiometricLoggingIn(true);
      const credential = await getBiometricCredential();
      if (!credential) {
        setBiometricAvailable(false);
        Alert.alert(
          'Biometric sign in unavailable',
          'Enable biometric sign in again from your Sagawa profile.',
        );
        return;
      }

      const response = await apiRequest<{
        success: boolean;
        data: {
          accessToken: string;
          refreshToken: string;
          expiresAt: string;
          profileCompleted: boolean;
          user: { id: string; email?: string; phoneNumber?: string };
        };
      }>('/api/auth/biometric/login', {
        method: 'POST',
        body: JSON.stringify({ credential, platform: Platform.OS }),
      });

      await persistSession(response.data);
    } catch (error) {
      Alert.alert(
        'Biometric sign in failed',
        error instanceof Error ? error.message : 'Unable to sign in with biometrics.',
      );
    } finally {
      setBiometricLoggingIn(false);
    }
  };

  const handleGuestContinue = async () => {
    try {
      setGuestContinuing(true);
      await useAuthStore.getState().continueAsGuest();
      router.replace('/(tabs)' as Href);
    } catch {
      Alert.alert('Unable to continue', 'Guest mode could not be started.');
    } finally {
      setGuestContinuing(false);
    }
  };

  const busy = loggingIn || googleLoggingIn || guestContinuing || biometricLoggingIn;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ImageBackground source={LOGIN_BACKGROUND} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <View style={styles.overlay} />
      </ImageBackground>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brandSection}>
              <SagawaFlowerLogo width={60} height={60} accessibilityLabel="Sagawa flower logo" />
              <Text style={styles.brandName}>Sagawa</Text>
            </View>

            <View style={styles.loginPanel}>
              {stage === 'login' ? (
                <>
                  <Text style={styles.title}>Welcome back</Text>
                  <Text style={styles.subtitle}>Sign in securely with Sagawa.</Text>

                  <View style={styles.segment}>
                    <Pressable
                      onPress={() => {
                        setChannel('email');
                        setIdentifier('');
                      }}
                      style={[styles.segmentButton, channel === 'email' && styles.segmentButtonActive]}
                    >
                      <Text style={[styles.segmentText, channel === 'email' && styles.segmentTextActive]}>
                        Email
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setChannel('phone');
                        setIdentifier('');
                      }}
                      style={[styles.segmentButton, channel === 'phone' && styles.segmentButtonActive]}
                    >
                      <Text style={[styles.segmentText, channel === 'phone' && styles.segmentTextActive]}>
                        Phone
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{channel === 'email' ? 'Email' : 'Phone number'}</Text>
                    <TextInput
                      value={identifier}
                      onChangeText={setIdentifier}
                      placeholder={channel === 'email' ? 'you@example.com' : '+60'}
                      placeholderTextColor="#98A2B3"
                      keyboardType={channel === 'email' ? 'email-address' : 'phone-pad'}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={styles.input}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.passwordWrap}>
                      <TextInput
                        ref={passwordInputRef}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Enter your password"
                        placeholderTextColor="#98A2B3"
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={[styles.input, styles.passwordInput]}
                      />
                      <Pressable
                        onPress={() => {
                          setShowPassword((value) => !value);
                          requestAnimationFrame(() => passwordInputRef.current?.focus());
                        }}
                        style={styles.eyeButton}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={22}
                          color="#667085"
                        />
                      </Pressable>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => router.push('/forgot-password' as Href)}
                    style={styles.forgotButton}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => void handlePasswordLogin()}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.buttonPressed,
                      busy && styles.disabled,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {loggingIn ? 'Signing in...' : 'Log in'}
                    </Text>
                  </Pressable>

                  {biometricAvailable && (
                    <Pressable
                      onPress={() => void handleBiometricLogin()}
                      disabled={busy}
                      style={({ pressed }) => [
                        styles.codeButton,
                        pressed && styles.buttonPressed,
                        busy && styles.disabled,
                      ]}
                    >
                      <Ionicons name="finger-print-outline" size={20} color="#245B8E" />
                      <Text style={styles.codeButtonText}>
                        {biometricLoggingIn ? 'Checking...' : 'Sign in with biometrics'}
                      </Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.title}>Verify it&apos;s you</Text>
                  <Text style={styles.subtitle}>
                    Enter the 6-digit code sent to {identifierHint || 'your verified contact'}.
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Verification code</Text>
                    <TextInput
                      value={code}
                      onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      placeholderTextColor="#98A2B3"
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
                      maxLength={6}
                      style={[styles.input, styles.codeInput]}
                    />
                  </View>

                  <Pressable
                    onPress={() => void verifyLoginCode()}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.buttonPressed,
                      busy && styles.disabled,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>
                      {loggingIn ? 'Verifying...' : 'Verify & log in'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setStage('login');
                      setCode('');
                      setChallengeId('');
                    }}
                    style={styles.backToLoginButton}
                  >
                    <Text style={styles.backToLoginText}>Back to sign in</Text>
                  </Pressable>
                </>
              )}

              {stage === 'login' && (
                <>
                  <View style={styles.dividerRow}>
                    <View style={styles.divider} />
                    <Text style={styles.dividerText}>or continue with</Text>
                    <View style={styles.divider} />
                  </View>

                  <View style={styles.socialRow}>
                    <Pressable
                      onPress={() => void handleGoogleLogin()}
                      disabled={busy}
                      style={({ pressed }) => [styles.socialButton, pressed && styles.socialPressed]}
                    >
                      <Text style={styles.googleIcon}>G</Text>
                      <Text style={styles.socialText}>{googleLoggingIn ? 'Signing in...' : 'Google'}</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => void handleGuestContinue()}
                      disabled={busy}
                      style={({ pressed }) => [styles.socialButton, pressed && styles.socialPressed]}
                    >
                      <Ionicons name="person-outline" size={18} color="#344054" />
                      <Text style={styles.socialText}>{guestContinuing ? 'Opening...' : 'Guest'}</Text>
                    </Pressable>
                  </View>

                  <View style={styles.signupRow}>
                    <Text style={styles.signupText}>Don&apos;t have an account?</Text>
                    <Pressable onPress={() => router.push('/signup' as Href)}>
                      <Text style={styles.signupLink}> Sign up</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>

            <Text style={styles.footer}>By continuing, you agree to our Terms and Privacy Policy.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F9FF' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(244,249,255,0.88)' },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  brandSection: { alignItems: 'center', marginBottom: 12, gap: 4 },
  brandName: { color: '#10243E', fontSize: 18, fontWeight: '700' },
  loginPanel: {
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: '#DDEAF6',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#0B315B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 3,
  },
  title: {
    color: '#101828',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: ANDROID_EXTRA_BOLD,
    letterSpacing: -0.7,
  },
  subtitle: { color: '#667085', fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 18 },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#F2F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  segmentButton: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: { backgroundColor: '#FFFFFF' },
  segmentText: { color: '#667085', fontWeight: '600' },
  segmentTextActive: { color: '#1677D2' },
  inputGroup: { marginBottom: 13 },
  label: { color: '#344054', fontSize: 14, fontWeight: '600', marginBottom: 7 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#101828',
  },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 52 },
  eyeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: 21, fontWeight: '700' },
  forgotButton: { alignSelf: 'flex-end', marginTop: -2, marginBottom: 14 },
  forgotText: { color: '#3195F5', fontSize: 14, fontWeight: '600' },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#3195F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  codeButton: {
    height: 48,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#D7E8F8',
    borderRadius: 14,
    backgroundColor: '#F7FBFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  codeButtonText: { color: '#245B8E', fontSize: 14, fontWeight: '600' },
  backToLoginButton: { alignItems: 'center', paddingVertical: 14 },
  backToLoginText: { color: '#3195F5', fontSize: 14, fontWeight: '700' },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 17 },
  divider: { flex: 1, height: 1, backgroundColor: '#E5EAF0' },
  dividerText: { marginHorizontal: 11, color: '#98A2B3', fontSize: 12 },
  socialRow: { flexDirection: 'row', gap: 10 },
  socialButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialPressed: { backgroundColor: '#F5F8FB' },
  googleIcon: { fontSize: 17, fontWeight: ANDROID_EXTRA_BOLD, color: '#4285F4' },
  socialText: { fontSize: 14, fontWeight: '600', color: '#344054' },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  signupText: { fontSize: 14, color: '#667085' },
  signupLink: { fontSize: 14, fontWeight: '700', color: '#3195F5' },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    color: '#667085',
    marginTop: 14,
    paddingHorizontal: 18,
  },
});
