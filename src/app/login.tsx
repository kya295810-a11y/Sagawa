import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ImageBackground,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Linking from "expo-linking";
import { router, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { apiRequest } from '@/services/api/client';
import { useAuthStore } from '@/store/auth-store';

const LOGIN_BACKGROUND = require("../../assets/images/login-bg.jpg");
const ANDROID_EXTRA_BOLD = Platform.OS === "android" ? "700" : "800";
const INPUT_PLACEHOLDER_COLOR = Platform.OS === "android" ? "#C4CEDA" : "#AAB4C3";
const ANDROID_INPUT_TEXT_FIX = Platform.select({
  android: {
    paddingVertical: 0,
    textAlignVertical: "center" as const,
  },
  default: {},
});

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [googleLoggingIn, setGoogleLoggingIn] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);

  const togglePasswordVisibility = () => {
    setShowPassword((current) => !current);
    requestAnimationFrame(() => passwordInputRef.current?.focus());
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      return;
    }

    try {
      setLoggingIn(true);
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
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password, accountType: 'mobile' }),
      });

      if (!response.success || !response.data?.accessToken) {
        throw new Error(response.message || 'Unable to sign in.');
      }

      await useAuthStore.getState().setSession(
        {
          expiresAt: response.data.expiresAt || null,
          profileCompleted: Boolean(response.data.profileCompleted),
          user: { id: response.data.user?.id || email.trim() },
        },
        {
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken || response.data.accessToken,
        },
      );

      router.replace((response.data.profileCompleted ? "/(tabs)" : "/complete-profile") as Href);
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Sign In Failed', error instanceof Error ? error.message : 'Unable to sign in.');
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
    if (!response.success || !response.data?.accessToken || !response.data.user?.id) {
      throw new Error(response.message || 'Unable to complete Google sign-in.');
    }

    await useAuthStore.getState().setSession(
      {
        expiresAt: response.data.expiresAt || null,
        profileCompleted: Boolean(response.data.profileCompleted),
        user: {
          id: response.data.user.id,
          email: response.data.user.email,
        },
      },
      {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken || response.data.accessToken,
      },
    );

    router.replace((response.data.profileCompleted ? '/(tabs)' : '/complete-profile') as Href);
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

    if (isCancelledResponse(googleResponse)) {
      return;
    }
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

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return;
    }
    if (result.type !== 'success' || !result.url) {
      throw new Error('Google sign-in could not be completed.');
    }

    const parsed = Linking.parse(result.url);
    const query = parsed.queryParams ?? {};
    const errorCode = typeof query.error === 'string' ? query.error : '';
    const errorDescription =
      typeof query.error_description === 'string' ? query.error_description : '';

    if (errorCode) {
      throw new Error(errorDescription || 'Google sign-in failed.');
    }

    const code = typeof query.code === 'string' ? query.code : '';
    if (!code) {
      throw new Error('Google sign-in response is missing the authorization code.');
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
    }>('/api/auth/google/exchange', {
      method: 'POST',
      body: JSON.stringify({ code }),
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
      console.error('Google login error:', error);
      const message =
        error instanceof Error ? error.message : 'Unable to sign in with Google.';
      Alert.alert(
        'Google Sign In Failed',
        message.includes('NitroGoogleSignin')
          ? 'Native Google Sign-In is not installed in this development build. Rebuild Sagawa for Android once.'
          : message,
      );
    } finally {
      setGoogleLoggingIn(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* Background image */}
      <View pointerEvents="none" style={styles.background}>
        <ImageBackground
          source={LOGIN_BACKGROUND}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        >
          {/* Blur */}
          {Platform.OS === "ios" && (
            <BlurView
              intensity={48}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          )}

          {/* Blue / dark overlay */}
          <View style={styles.overlay} />
        </ImageBackground>
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            {/* Brand */}
            <View style={styles.brandSection}>
              <Text
                style={styles.brandName}
                allowFontScaling={false}
              >
                Sagawa
              </Text>
            </View>

            {/* Login panel */}
            <View style={styles.loginPanel}>
              {Platform.OS === "ios" && (
                <BlurView
                  intensity={25}
                  tint="light"
                  pointerEvents="none"
                  style={StyleSheet.absoluteFill}
                />
              )}
              <View pointerEvents="none" style={styles.panelOverlay} />

              {/* Header */}
              <View style={styles.header}>
                <Text
                  style={styles.title}
                  allowFontScaling={false}
                >
                  Welcome back
                </Text>

                <Text
                  style={styles.subtitle}
                  allowFontScaling={false}
                >
                  Sign in to continue with Sagawa.
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                {/* Email */}
                <View style={styles.inputGroup}>
                  <Text
                    style={styles.label}
                    allowFontScaling={false}
                  >
                    Email
                  </Text>

                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    allowFontScaling={false}
                  />
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label} allowFontScaling={false}>
                    Password
                  </Text>

                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      ref={passwordInputRef}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter your password"
                      placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[styles.input, styles.passwordInput]}
                      allowFontScaling={false}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      onPress={togglePasswordVisibility}
                      style={styles.passwordVisibilityButton}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={22}
                        color="#C9E6FF"
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Forgot password */}
                <Pressable
                  onPress={() =>
                    router.push("/forgot-password" as Href)
                  }
                  style={styles.forgotButton}
                  hitSlop={8}
                >
                  <Text
                    style={styles.forgotText}
                    allowFontScaling={false}
                  >
                    Forgot password?
                  </Text>
                </Pressable>

                {/* Login */}
                <Pressable
                  onPress={() => void handleLogin()}
                  disabled={loggingIn}
                  style={({ pressed }) => [
                    styles.loginButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={styles.loginButtonText}
                    allowFontScaling={false}
                  >
                    {loggingIn ? "Signing in..." : "Log in"}
                  </Text>
                </Pressable>
              </View>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.divider} />

                <Text
                  style={styles.dividerText}
                  allowFontScaling={false}
                >
                  or continue with
                </Text>

                <View style={styles.divider} />
              </View>

              {/* Social buttons */}
              <View style={styles.socialRow}>
                <Pressable
                  onPress={() => void handleGoogleLogin()}
                  disabled={googleLoggingIn || loggingIn}
                  style={({ pressed }) => [
                    styles.socialButton,
                    pressed && styles.socialPressed,
                    (googleLoggingIn || loggingIn) && { opacity: 0.6 },
                  ]}
                >
                  <Text
                    style={styles.googleIcon}
                    allowFontScaling={false}
                  >
                    G
                  </Text>

                  <Text
                    style={styles.socialText}
                    allowFontScaling={false}
                  >
                    {googleLoggingIn ? "Signing in..." : "Google"}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.socialButton,
                    pressed && styles.socialPressed,
                  ]}
                >
                  <Text
                    style={styles.appleIcon}
                    allowFontScaling={false}
                  >
                    ●
                  </Text>

                  <Text
                    style={styles.socialText}
                    allowFontScaling={false}
                  >
                    Apple
                  </Text>
                </Pressable>
              </View>

              {/* Sign up */}
              <View style={styles.signupRow}>
                <Text
                  style={styles.signupText}
                  allowFontScaling={false}
                >
                  Don&apos;t have an account?
                </Text>

                <Pressable
                  onPress={() => router.push("/signup" as Href)}
                  hitSlop={8}
                >
                  <Text
                    style={styles.signupLink}
                    allowFontScaling={false}
                  >
                    {" "}Sign up
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Footer */}
            <Text
              style={styles.footer}
              allowFontScaling={false}
            >
              By continuing, you agree to our Terms and Privacy Policy.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#071A31",
  },

  background: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Platform.OS === "android"
      ? "rgba(3,18,40,0.68)"
      : "rgba(3,18,40,0.48)",
  },

  safeArea: {
    flex: 1,
    zIndex: 1,
    elevation: 1,
  },

  keyboardView: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },

  /* Brand */

  brandSection: {
    alignItems: "center",
    marginBottom: 24,
  },

  brandName: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
    includeFontPadding: false,
  },

  /* Login panel */

  loginPanel: {
    overflow: "hidden",
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 25,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: Platform.OS === "android"
      ? "rgba(255,255,255,0.32)"
      : "rgba(255,255,255,0.25)",
    backgroundColor: Platform.OS === "android"
      ? "rgba(7,26,49,0.98)"
      : "rgba(255,255,255,0.14)",
  },

  panelOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Platform.OS === "android"
      ? "rgba(255,255,255,0.03)"
      : "rgba(255,255,255,0.08)",
  },

  /* Header */

  header: {
    marginBottom: 26,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 37,
    fontWeight: ANDROID_EXTRA_BOLD,
    letterSpacing: -0.8,
    marginBottom: 9,
    includeFontPadding: false,
  },

  subtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },

  /* Form */

  form: {
    width: "100%",
  },

  inputGroup: {
    marginBottom: 18,
  },

  label: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    marginBottom: 8,
    includeFontPadding: false,
  },

  input: {
    height: 54,
    borderWidth: 1,
    borderColor: Platform.OS === "android"
      ? "rgba(255,255,255,0.38)"
      : "rgba(255,255,255,0.28)",
    borderRadius: 15,
    backgroundColor: Platform.OS === "android"
      ? "rgba(20,45,70,0.98)"
      : "rgba(255,255,255,0.14)",
    paddingHorizontal: 16,
    fontSize: 16,
    lineHeight: 20,
    color: "#FFFFFF",
    elevation: 1,
    includeFontPadding: false,
    ...ANDROID_INPUT_TEXT_FIX,
  },

  passwordInputContainer: {
    position: "relative",
  },

  passwordInput: {
    paddingRight: 56,
  },

  passwordVisibilityButton: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 54,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },

  forgotButton: {
    alignSelf: "flex-end",
    marginTop: -2,
    marginBottom: 22,
  },

  forgotText: {
    color: "#C9E6FF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    includeFontPadding: false,
  },

  loginButton: {
    height: 54,
    borderRadius: 15,
    backgroundColor: "#3195F5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },

  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "700",
    includeFontPadding: false,
  },

  /* Divider */

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.20)",
  },

  dividerText: {
    marginHorizontal: 11,
    color: "rgba(255,255,255,0.60)",
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
  },

  /* Social */

  socialRow: {
    flexDirection: "row",
    gap: 10,
  },

  socialButton: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  socialPressed: {
    backgroundColor: "rgba(255,255,255,0.20)",
  },

  googleIcon: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: ANDROID_EXTRA_BOLD,
    color: "#FFFFFF",
    includeFontPadding: false,
  },

  appleIcon: {
    fontSize: 14,
    lineHeight: 18,
    color: "#FFFFFF",
    includeFontPadding: false,
  },

  socialText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    includeFontPadding: false,
  },

  /* Sign up */

  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },

  signupText: {
    fontSize: 14,
    lineHeight: 18,
    color: "rgba(255,255,255,0.76)",
    includeFontPadding: false,
  },

  signupLink: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: "#C9E6FF",
    includeFontPadding: false,
  },

  /* Footer */

  footer: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    color: "rgba(255,255,255,0.60)",
    marginTop: 20,
    paddingHorizontal: 18,
    includeFontPadding: false,
  },
});
