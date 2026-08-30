import React, { useState } from "react";
import {
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
  const [sent, setSent] = useState(false);

  const handleReset = () => {
    if (!email.trim()) {
      return;
    }

    // Temporary UI state.
    // Real password reset will be connected later.
    setSent(true);
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

          {!sent ? (
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
                  onPress={handleReset}
                  style={({ pressed }) => [
                    styles.resetButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.resetButtonText}>
                    Send reset link
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            /* Success */
            <View style={styles.successSection}>
              <View style={styles.successIcon}>
                <Text style={styles.successCheck}>✓</Text>
              </View>

              <Text style={styles.successTitle}>Check your email</Text>

              <Text style={styles.successText}>
                If an account exists for{" "}
                <Text style={styles.emailText}>{email}</Text>,we&apos;ve sent instructions to reset your password.
              </Text>

              <Pressable
                onPress={() => setSent(false)}
                style={styles.tryAgainButton}
              >
                <Text style={styles.tryAgainText}>
                  Try another email
                </Text>
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
