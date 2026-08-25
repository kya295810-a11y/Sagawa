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

export default function SignupScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);

  const handleSignup = () => {
    // Temporary navigation for UI testing.
    // Real account creation will be connected later.
    router.replace("/(tabs)");
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
          {/* Back button */}
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backPressed,
            ]}
            hitSlop={8}
          >
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          {/* Brand */}
          <View style={styles.brandSection}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>M</Text>
            </View>

            <Text style={styles.brandName}>Sagawa</Text>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>

            <Text style={styles.subtitle}>
  A few details and you&apos;ll be ready to get started.
</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full name</Text>

              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
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
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <View style={styles.passwordHeader}>
                <Text style={styles.label}>Password</Text>

                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={8}
                >
                  <Text style={styles.showPassword}>
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>

              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />

              <Text style={styles.helperText}>
                Use at least 8 characters.
              </Text>
            </View>

            {/* Confirm password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm password</Text>

              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Enter your password again"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            {/* Terms */}
            <Pressable
              onPress={() => setAgree(!agree)}
              style={styles.termsRow}
            >
              <View
                style={[
                  styles.checkbox,
                  agree && styles.checkboxActive,
                ]}
              >
                {agree && <Text style={styles.checkmark}>✓</Text>}
              </View>

              <Text style={styles.termsText}>
                I agree to the{" "}
                <Text style={styles.termsLink}>Terms</Text>
                {" "}and{" "}
                <Text style={styles.termsLink}>Privacy Policy</Text>.
              </Text>
            </Pressable>

            {/* Create account */}
            <Pressable
              onPress={handleSignup}
              style={({ pressed }) => [
                styles.signupButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.signupButtonText}>
                Create account
              </Text>
            </Pressable>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />

            <Text style={styles.dividerText}>or continue with</Text>

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
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.socialText}>Google</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.socialButton,
                pressed && styles.socialPressed,
              ]}
            >
              <Text style={styles.appleIcon}>●</Text>
              <Text style={styles.socialText}>Apple</Text>
            </Pressable>
          </View>

          {/* Login */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>
              Already have an account?
            </Text>

            <Pressable
              onPress={() => router.replace("/login")}
              hitSlop={8}
            >
              <Text style={styles.loginLink}> Log in</Text>
            </Pressable>
          </View>

          {/* Footer */}
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
    paddingBottom: 28,
  },

  /* Back */

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 26,
    paddingVertical: 6,
  },

  backPressed: {
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
    fontWeight: "600",
    color: "#475467",
  },

  /* Brand */

  brandSection: {
    alignItems: "center",
    marginBottom: 34,
  },

  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#4AA8FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },

  brandName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#172033",
    letterSpacing: -0.3,
  },

  /* Header */

  header: {
    marginBottom: 28,
  },

  title: {
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
    color: "#101828",
    letterSpacing: -0.8,
    marginBottom: 9,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: "#667085",
    maxWidth: 330,
  },

  /* Form */

  form: {
    width: "100%",
  },

  inputGroup: {
    marginBottom: 18,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#344054",
    marginBottom: 8,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#101828",
  },

  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  showPassword: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3195F5",
  },

  helperText: {
    fontSize: 12,
    color: "#98A2B3",
    marginTop: 7,
  },

  /* Terms */

  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
    marginBottom: 24,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#C8D2DC",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 1,
  },

  checkboxActive: {
    backgroundColor: "#3195F5",
    borderColor: "#3195F5",
  },

  checkmark: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  termsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: "#667085",
  },

  termsLink: {
    color: "#3195F5",
    fontWeight: "600",
  },

  /* Button */

  signupButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#3195F5",
    alignItems: "center",
    justifyContent: "center",
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

  signupButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  /* Divider */

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 26,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5EAF0",
  },

  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: "#98A2B3",
  },

  /* Social */

  socialRow: {
    flexDirection: "row",
    gap: 12,
  },

  socialButton: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  socialPressed: {
    backgroundColor: "#F5F8FB",
  },

  googleIcon: {
    fontSize: 17,
    fontWeight: "800",
    color: "#4285F4",
  },

  appleIcon: {
    fontSize: 15,
    color: "#101828",
  },

  socialText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#344054",
  },

  /* Login */

  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },

  loginText: {
    fontSize: 14,
    color: "#667085",
  },

  loginLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3195F5",
  },

  /* Footer */

  footer: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
    color: "#98A2B3",
    marginTop: 24,
    paddingHorizontal: 20,
  },
});
