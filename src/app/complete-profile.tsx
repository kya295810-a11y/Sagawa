import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useUpdateProfile } from '@/features/profile/hooks';
import { useAuthStore } from '@/store/auth-store';

type Gender = 'male' | 'female';

const colors = {
  background: '#F4F7FB',
  border: '#D8E1EC',
  muted: '#66758A',
  primary: '#1769E0',
  primarySoft: '#E8F0FF',
  surface: '#FFFFFF',
  text: '#142033',
  white: '#FFFFFF',
};

export default function CompleteProfileScreen() {
  const updateProfile = useUpdateProfile();
  const ageInputRef = useRef<TextInput>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);

  const submit = async () => {
    const trimmedName = name.trim().replace(/\s+/g, ' ');
    const numericAge = Number(age);

    if (!trimmedName || trimmedName.length > 100) {
      Alert.alert('Check your name', 'Enter your full name using no more than 100 characters.');
      return;
    }
    if (
      !/^\d{1,3}$/.test(age) ||
      !Number.isInteger(numericAge) ||
      numericAge < 18 ||
      numericAge > 120
    ) {
      Alert.alert('Age requirement', 'You must be 18 or older to create and use a Sagawa account.');
      return;
    }
    if (!gender) {
      Alert.alert('Choose a gender', 'Select Male or Female to continue.');
      return;
    }

    try {
      await updateProfile.mutateAsync({ name: trimmedName, age: numericAge, gender, location: '' });
      useAuthStore.getState().markProfileCompleted();
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert(
        'Unable to save profile',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="person-add-outline" size={30} color={colors.primary} />
            </View>
            <View style={styles.stepBadge}>
              <Text style={styles.stepText}>FINAL STEP</Text>
            </View>
            <Text style={styles.title}>Set up your profile</Text>
            <Text style={styles.subtitle}>
              Add a few details to personalize Sagawa. You can update them later.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full name</Text>
              <View style={styles.inputShell}>
                <Ionicons name="person-outline" size={20} color={colors.muted} />
                <TextInput
                  accessibilityLabel="Full name"
                  autoCapitalize="words"
                  autoComplete="name"
                  maxLength={100}
                  onChangeText={setName}
                  onSubmitEditing={() => ageInputRef.current?.focus()}
                  placeholder="Enter your full name"
                  placeholderTextColor="#98A5B6"
                  returnKeyType="next"
                  style={styles.input}
                  value={name}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Age</Text>
              <View style={styles.inputShell}>
                <Ionicons name="calendar-outline" size={20} color={colors.muted} />
                <TextInput
                  ref={ageInputRef}
                  accessibilityLabel="Age"
                  keyboardType="number-pad"
                  maxLength={3}
                  onChangeText={(value) => setAge(value.replace(/\D/g, ''))}
                  placeholder="Enter your age"
                  placeholderTextColor="#98A5B6"
                  style={styles.input}
                  value={age}
                />
              </View>
              <Text style={styles.helper}>You must be at least 18 years old.</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Gender</Text>
              <View accessibilityRole="radiogroup" style={styles.genderRow}>
                {(['male', 'female'] as const).map((value) => {
                  const selected = gender === value;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      key={value}
                      onPress={() => setGender(value)}
                      style={({ pressed }) => [
                        styles.genderButton,
                        selected && styles.genderSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name={value === 'male' ? 'male-outline' : 'female-outline'}
                        size={20}
                        color={selected ? colors.primary : colors.muted}
                      />
                      <Text style={[styles.genderText, selected && styles.genderTextSelected]}>
                        {value === 'male' ? 'Male' : 'Female'}
                      </Text>
                      <Ionicons
                        name={selected ? 'radio-button-on' : 'radio-button-off'}
                        size={19}
                        color={selected ? colors.primary : '#A8B3C2'}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={updateProfile.isPending}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.continueButton,
                pressed && styles.pressed,
                updateProfile.isPending && styles.disabled,
              ]}
            >
              <Text style={styles.continueText}>
                {updateProfile.isPending ? 'Saving profile…' : 'Finish setup'}
              </Text>
              {!updateProfile.isPending ? (
                <Ionicons name="arrow-forward" size={20} color={colors.white} />
              ) : null}
            </Pressable>
          </View>

          <Text style={styles.privacyNote}>
            Your profile details stay private and are used only for your Sagawa account.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  content: {
    alignItems: 'center',
    flexGrow: 1,
    gap: 24,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    width: '100%',
  },
  header: { alignItems: 'center', gap: 10, maxWidth: 520, width: '100%' },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 22,
    height: 64,
    justifyContent: 'center',
    marginBottom: 2,
    width: 64,
  },
  stepBadge: {
    backgroundColor: '#EAF7F2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stepText: { color: '#18745B', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 340,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: '#E3E9F1',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    boxShadow: '0 12px 32px rgba(33, 52, 78, 0.08)',
    gap: 21,
    maxWidth: 520,
    padding: 22,
    width: '100%',
  },
  fieldGroup: { gap: 8 },
  label: { color: '#334257', fontSize: 14, fontWeight: '700', lineHeight: 19 },
  inputShell: {
    alignItems: 'center',
    backgroundColor: '#FBFCFE',
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 15,
  },
  input: { color: colors.text, flex: 1, fontSize: 16, minHeight: 52, paddingVertical: 0 },
  helper: { color: '#7A8798', fontSize: 12, lineHeight: 16 },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderButton: {
    alignItems: 'center',
    backgroundColor: '#FBFCFE',
    borderColor: colors.border,
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 54,
    paddingHorizontal: 13,
  },
  genderSelected: { backgroundColor: colors.primarySoft, borderColor: '#8FB4EF' },
  genderText: { color: '#4B5B70', flex: 1, fontSize: 15, fontWeight: '600' },
  genderTextSelected: { color: colors.primary },
  continueButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderCurve: 'continuous',
    borderRadius: 15,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 56,
  },
  continueText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.6 },
  privacyNote: {
    color: '#7A8798',
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 520,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
