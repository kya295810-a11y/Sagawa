import React, { useState } from "react";
import {
  ActivityIndicator,
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
} from "react-native";
import { router } from "expo-router";
import { apiRequest } from '@/services/api/client';

const ANDROID_EXTRA_BOLD = Platform.OS === "android" ? "700" : "800";
const ANDROID_INPUT_TEXT_FIX = Platform.select({
  android: {
    paddingVertical: 0,
    textAlignVertical: "center" as const,
  },
  default: {},
});

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [stage, setStage] = useState<'request' | 'verify' | 'complete'>('request');
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    try {
      setSubmitting(true);
      await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, accountType: 'mobile' }),
      });
      setEmail(normalizedEmail);
      setStage('verify');
    } catch (error) {
      Alert.alert(
        'Unable to send code',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteReset = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your email.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Enter the same password twice.');
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          code: code.trim(),
          newPassword,
          confirmPassword,
        }),
      });
      setStage('complete');
    } catch (error) {
      Alert.alert(
        'Password reset failed',
        error instanceof Error ? error.message : 'Please request a new code and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <Pressable
            onPress={() => router.replace("/login")}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Back to login</Text>
          </Pressable>

          {/* Brand */}
          <View style={styles.brandSection}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>M</Text>
            </View>

            <Text style={styles.brandName}>Sagawa</Text>
          </View>

          {stage === 'request' ? (
            <>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Forgot your password?</Text>

                <Text style={styles.subtitle}>
                  No worries. Enter the email connected to your account and
                 we&apos;ll help you get back in.
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                <Text style={styles.label}>Email</Text>

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />

                <Pressable
                  onPress={() => void handleReset()}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.resetButton,
                    pressed && styles.buttonPressed,
                    submitting && styles.buttonDisabled,
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.resetButtonText}>Send reset code</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : stage === 'verify' ? (
            <View style={styles.successSection}>
              <View style={styles.successIcon}>
                <Text style={styles.successCheck}>✓</Text>
              </View>

              <Text style={styles.successTitle}>Check your email</Text>

              <Text style={styles.successText}>
                If an account exists for{" "}
                <Text style={styles.emailText}>{email}</Text>, we&apos;ve sent a 6-digit reset code.
              </Text>

              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Reset code</Text>
                  <TextInput
                    value={code}
                    onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    maxLength={6}
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>New password</Text>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="At least 8 characters"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Confirm password</Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Enter the password again"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>

                <Pressable
                  onPress={() => void handleCompleteReset()}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.resetButton,
                    pressed && styles.buttonPressed,
                    submitting && styles.buttonDisabled,
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.resetButtonText}>Reset password</Text>
                  )}
                </Pressable>
              </View>

              <Pressable
                onPress={() => {
                  setCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setStage('request');
                }}
                style={styles.tryAgainButton}
              >
                <Text style={styles.tryAgainText}>Request another code</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.successSection}>
              <View style={styles.successIcon}>
                <Text style={styles.successCheck}>✓</Text>
              </View>
              <Text style={styles.successTitle}>Password updated</Text>
              <Text style={styles.successText}>
                Your existing sessions were signed out. Log in with your new password.
              </Text>
              <Pressable
                onPress={() => router.replace('/login')}
                style={({ pressed }) => [styles.resetButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.resetButtonText}>Back to login</Text>
              </Pressable>
            </View>
          )}

          {/* Bottom */}
          <View style={styles.bottomSection}>
            <Text style={styles.bottomText}>Remember your password?</Text>

            <Pressable
              onPress={() => router.replace("/login")}
              hitSlop={8}
            >
              <Text style={styles.loginLink}> Log in</Text>
            </Pressable>
          </View>

          <Text style={styles.footer}>
            Your information is kept private and secure.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FBFF",
  },

  keyboardView: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 30,
  },

  /* Back */

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
    marginBottom: 44,
  },

  pressed: {
    opacity: 0.55,
  },

  backIcon: {
    fontSize: 28,
    lineHeight: 28,
    color: "#344054",
    marginRight: 4,
  },

  backText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    color: "#475467",
  },

  /* Brand */

  brandSection: {
    alignItems: "center",
    marginBottom: 46,
  },

  logo: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#4AA8FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 23,
    lineHeight: 28,
    fontWeight: ANDROID_EXTRA_BOLD,
  },

  brandName: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: "#172033",
    letterSpacing: -0.3,
  },

  /* Header */

  header: {
    marginBottom: 30,
  },

  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: ANDROID_EXTRA_BOLD,
    color: "#101828",
    letterSpacing: -0.8,
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: "#667085",
  },

  /* Form */

  form: {
    width: "100%",
  },

  fieldGroup: {
    width: "100%",
    marginTop: 18,
  },

  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    color: "#344054",
    marginBottom: 8,
  },

  input: {
    height: 54,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    fontSize: 16,
    lineHeight: 20,
    color: "#101828",
    ...ANDROID_INPUT_TEXT_FIX,
  },

  resetButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#3195F5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    shadowColor: "#3195F5",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },

  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  resetButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },

  /* Success */

  successSection: {
    alignItems: "center",
    marginTop: 4,
  },

  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E8F5EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },

  successCheck: {
    fontSize: 28,
    fontWeight: "700",
    color: "#24965A",
  },

  successTitle: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: ANDROID_EXTRA_BOLD,
    color: "#101828",
    letterSpacing: -0.5,
    marginBottom: 12,
  },

  successText: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22,
    color: "#667085",
  },

  emailText: {
    fontWeight: "700",
    color: "#344054",
  },

  tryAgainButton: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  tryAgainText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "#3195F5",
  },

  /* Bottom */

  bottomSection: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 42,
  },

  bottomText: {
    fontSize: 14,
    lineHeight: 18,
    color: "#667085",
  },

  loginLink: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "#3195F5",
  },

  /* Footer */

  footer: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    color: "#98A2B3",
    marginTop: 28,
    paddingHorizontal: 20,
  },
});
