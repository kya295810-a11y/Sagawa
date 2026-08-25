import React, { useState } from "react";
import {
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
import { router, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const LOGIN_BACKGROUND = require("../../assets/images/login-bg.jpg");

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    // Temporary login for UI testing.
    // Real authentication will be connected later.
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* Background image */}
      <ImageBackground
        source={LOGIN_BACKGROUND}
        resizeMode="cover"
        style={styles.background}
      >
        {/* Blur */}
        <BlurView
          intensity={48}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />

        {/* Blue / dark overlay */}
        <View style={styles.overlay} />
      </ImageBackground>

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
            {/* Brand */}
            <View style={styles.brandSection}>
              <View style={styles.logo}>
                <Text
                  style={styles.logoText}
                  allowFontScaling={false}
                >
                  M
                </Text>
              </View>

              <Text
                style={styles.brandName}
                allowFontScaling={false}
              >
                Sagawa
              </Text>
            </View>

            {/* Login panel */}
            <BlurView
              intensity={25}
              tint="light"
              style={styles.loginPanel}
            >
              <View style={styles.panelOverlay} />

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
                    placeholderTextColor="#AAB4C3"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    allowFontScaling={false}
                  />
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <View style={styles.passwordHeader}>
                    <Text
                      style={styles.label}
                      allowFontScaling={false}
                    >
                      Password
                    </Text>

                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={8}
                    >
                      <Text
                        style={styles.showPassword}
                        allowFontScaling={false}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </Text>
                    </Pressable>
                  </View>

                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor="#AAB4C3"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                    allowFontScaling={false}
                  />
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
                  onPress={handleLogin}
                  style={({ pressed }) => [
                    styles.loginButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={styles.loginButtonText}
                    allowFontScaling={false}
                  >
                    Log in
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
                  style={({ pressed }) => [
                    styles.socialButton,
                    pressed && styles.socialPressed,
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
                    Google
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
            </BlurView>

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
    backgroundColor: "rgba(3, 18, 40, 0.48)",
  },

  safeArea: {
    flex: 1,
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

  logo: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#3195F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "800",
    includeFontPadding: false,
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
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  panelOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  /* Header */

  header: {
    marginBottom: 26,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
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
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 16,
    fontSize: 16,
    lineHeight: 20,
    color: "#FFFFFF",
    includeFontPadding: false,
  },

  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  showPassword: {
    color: "#BFE0FF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    includeFontPadding: false,
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
    fontWeight: "800",
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
