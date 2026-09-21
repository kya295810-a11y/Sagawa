import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, type Href } from 'expo-router';

import SagawaFlowerLogo from '../../assets/images/sagawa-flower-logo.svg';
import { apiRequest } from '@/services/api/client';
import { useAuthStore } from '@/store/auth-store';

type Channel = 'email' | 'phone';

const ANDROID_EXTRA_BOLD = Platform.OS === 'android' ? '700' : '800';

export default function SignupScreen() {
  const [stage, setStage] = useState<'details' | 'verify'>('details');
  const [channel, setChannel] = useState<Channel>('email');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [identifierHint, setIdentifierHint] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requestVerification = async () => {
    const trimmedName = name.trim().replace(/\s+/g, ' ');
    const numericAge = Number(age);

    if (!trimmedName || trimmedName.length > 100) {
      Alert.alert('Check your name', 'Enter your name using 100 characters or fewer.');
      return;
    }
    if (!/^\d{1,3}$/.test(age) || !Number.isInteger(numericAge) || numericAge < 18 || numericAge > 120) {
      Alert.alert('Age requirement', 'You must be 18 or older to create a Sagawa account.');
      return;
    }
    if (!identifier.trim()) {
      Alert.alert(
        channel === 'email' ? 'Email required' : 'Phone number required',
        channel === 'email'
          ? 'Enter your email address.'
          : 'Enter a Malaysia mobile number.',
      );
      return;
    }
    if (password.length < 6 || password.length > 128) {
      Alert.alert('Check your password', 'Use at least 6 characters.');
      return;
    }
    if (!agree) {
      Alert.alert('Agreement required', 'Please accept the Terms and Privacy Policy.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiRequest<{
        success: boolean;
        data: {
          challengeId: string;
          identifierHint: string;
          verificationRequired: boolean;
          expiresAt: string;
        };
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          age: numericAge,
          identifier: identifier.trim(),
          channel,
          country: channel === 'phone' ? 'MY' : undefined,
          password,
          platform: Platform.OS,
        }),
      });

      setChallengeId(response.data.challengeId);
      setIdentifierHint(response.data.identifierHint);
      setCode('');
      setStage('verify');
    } catch (error) {
      Alert.alert(
        'Unable to send verification code',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const verifyAndCreateAccount = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert('Invalid code', 'Enter the 6-digit verification code.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiRequest<{
        success: boolean;
        data: {
          accessToken: string;
          refreshToken: string;
          expiresAt: string;
          profileCompleted: boolean;
          user: { id: string; email?: string; phoneNumber?: string };
        };
      }>('/api/auth/register/verify', {
        method: 'POST',
        body: JSON.stringify({
          challengeId,
          code: code.trim(),
          platform: Platform.OS,
        }),
      });

      await useAuthStore.getState().setSession(
        {
          expiresAt: response.data.expiresAt,
          profileCompleted: true,
          user: response.data.user,
        },
        {
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
        },
      );

      router.replace('/(tabs)' as Href);
    } catch (error) {
      Alert.alert(
        'Verification failed',
        error instanceof Error ? error.message : 'Request a new code and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => {
              if (stage === 'verify') {
                setStage('details');
                setCode('');
                setChallengeId('');
                return;
              }
              router.replace('/login');
            }}
            style={styles.backButton}
            hitSlop={8}
          >
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.brandSection}>
            <SagawaFlowerLogo width={62} height={62} accessibilityLabel="Sagawa flower logo" />
            <Text style={styles.brandName}>Sagawa</Text>
          </View>

          <View style={[styles.card, stage === 'verify' && styles.verifyCard]}>
            {stage === 'details' ? (
              <>
                <Text style={styles.title}>Create your account</Text>
                <Text style={styles.subtitle}>
                  Sign up with a verified email or Malaysia phone number.
                </Text>

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
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name"
                    placeholderTextColor="#98A2B3"
                    autoCapitalize="words"
                    maxLength={100}
                    style={styles.input}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Age</Text>
                  <TextInput
                    value={age}
                    onChangeText={(value) => setAge(value.replace(/\D/g, ''))}
                    placeholder=""
                    placeholderTextColor="#98A2B3"
                    keyboardType="number-pad"
                    maxLength={3}
                    style={styles.input}
                  />
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
                  <View style={styles.passwordHeader}>
                    <Text style={styles.label}>Password</Text>
                    <Pressable onPress={() => setShowPassword((value) => !value)} hitSlop={8}>
                      <Text style={styles.showPassword}>{showPassword ? 'Hide' : 'Show'}</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor="#98A2B3"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>

                <Pressable onPress={() => setAgree((value) => !value)} style={styles.termsRow}>
                  <View style={[styles.checkbox, agree && styles.checkboxActive]}>
                    {agree && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.termsText}>
                    I agree to the <Text style={styles.termsLink}>Terms</Text> and{' '}
                    <Text style={styles.termsLink}>Privacy Policy</Text>.
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void requestVerification()}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                    submitting && styles.disabled,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {submitting ? 'Sending code...' : 'Continue'}
                  </Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.verifyContent}>
                <View style={styles.verifyIconWrap}>
                  <Ionicons
                    name={channel === 'email' ? 'mail-outline' : 'phone-portrait-outline'}
                    size={24}
                    color="#1677D2"
                  />
                </View>

                <Text style={styles.verifyTitle}>
                  {channel === 'email' ? 'Check your email' : 'Check your phone'}
                </Text>
                <Text style={styles.verifySubtitle}>Enter the 6-digit code sent to</Text>
                <Text style={styles.verifyDestination}>
                  {identifierHint || identifier.trim()}
                </Text>

                <TextInput
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  placeholderTextColor="#B8C1CC"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  autoFocus
                  style={styles.verifyCodeInput}
                />

                <Pressable
                  onPress={() => void verifyAndCreateAccount()}
                  disabled={submitting || code.length !== 6}
                  style={({ pressed }) => [
                    styles.verifyButton,
                    pressed && styles.buttonPressed,
                    (submitting || code.length !== 6) && styles.verifyButtonDisabled,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {submitting ? 'Verifying...' : 'Verify'}
                  </Text>
                </Pressable>

                <View style={styles.verifyMetaRow}>
                  <Text style={styles.expiryText}>Code expires in 10 minutes</Text>
                  <Pressable
                    onPress={() => void requestVerification()}
                    disabled={submitting}
                    hitSlop={8}
                  >
                    <Text style={styles.resendLink}>Resend code</Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => {
                    setStage('details');
                    setCode('');
                    setChallengeId('');
                  }}
                  style={styles.changeContactButton}
                  hitSlop={8}
                >
                  <Ionicons name="chevron-back" size={15} color="#667085" />
                  <Text style={styles.changeContactText}>
                    {channel === 'email' ? 'Change email' : 'Change phone number'}
                  </Text>
                </Pressable>
              </View>
            )}

            {stage === 'details' && (
              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Already have an account?</Text>
                <Pressable onPress={() => router.replace('/login')} hitSlop={8}>
                  <Text style={styles.loginLink}> Log in</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F9FF' },
  keyboardView: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  backButton: {
    position: 'absolute',
    top: 14,
    left: 20,
    zIndex: 2,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backIcon: { fontSize: 28, color: '#344054', marginRight: 3 },
  backText: { fontSize: 14, fontWeight: '600', color: '#475467' },
  brandSection: { alignItems: 'center', marginBottom: 12, gap: 4 },
  brandName: { fontSize: 18, fontWeight: '700', color: '#172033' },
  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E2ECF6',
    padding: 22,
    shadowColor: '#0B315B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: ANDROID_EXTRA_BOLD,
    color: '#101828',
    letterSpacing: -0.7,
  },
  subtitle: { marginTop: 7, marginBottom: 18, fontSize: 14, lineHeight: 21, color: '#667085' },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#F2F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
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
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: '#344054', marginBottom: 7 },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 14,
    backgroundColor: '#FBFDFF',
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#101828',
  },
  verifyCard: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 24,
  },
  verifyContent: {
    width: '100%',
    alignItems: 'center',
  },
  verifyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF7FF',
    marginBottom: 16,
  },
  verifyTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: ANDROID_EXTRA_BOLD,
    color: '#101828',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  verifySubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#667085',
    textAlign: 'center',
  },
  verifyDestination: {
    marginTop: 2,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#344054',
    textAlign: 'center',
  },
  verifyCodeInput: {
    width: '100%',
    height: 58,
    borderWidth: 1.5,
    borderColor: '#D3DFEA',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    textAlign: 'center',
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: 10,
    color: '#101828',
  },
  verifyButton: {
    width: '100%',
    height: 52,
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#3195F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonDisabled: {
    backgroundColor: '#B9D9F7',
  },
  verifyMetaRow: {
    width: '100%',
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expiryText: { fontSize: 12, color: '#98A2B3' },
  resendLink: { fontSize: 13, fontWeight: '700', color: '#1677D2' },
  changeContactButton: {
    marginTop: 18,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeContactText: { fontSize: 13, fontWeight: '600', color: '#667085' },
  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  showPassword: { fontSize: 13, fontWeight: '600', color: '#3195F5' },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 2, marginBottom: 18 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C8D2DC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  checkboxActive: { backgroundColor: '#3195F5', borderColor: '#3195F5' },
  checkmark: { color: '#FFFFFF', fontSize: 13, fontWeight: ANDROID_EXTRA_BOLD },
  termsText: { flex: 1, fontSize: 12, lineHeight: 19, color: '#667085' },
  termsLink: { color: '#3195F5', fontWeight: '600' },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#3195F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  buttonPressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  loginText: { fontSize: 14, color: '#667085' },
  loginLink: { fontSize: 14, fontWeight: '700', color: '#3195F5' },
});
