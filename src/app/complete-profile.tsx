import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { useAppTheme } from '@/theme/provider';

type Gender = 'male' | 'female';

export default function CompleteProfileScreen() {
  const { theme } = useAppTheme();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: theme.colors.background },
        content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
        card: {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          gap: 20,
          padding: 24,
          ...theme.shadows.md,
        },
        title: { ...theme.typography.heading, color: theme.colors.text },
        subtitle: { ...theme.typography.body, color: theme.colors.textSecondary },
        group: { gap: 8 },
        label: { ...theme.typography.label, color: theme.colors.text },
        input: {
          ...theme.typography.body,
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          color: theme.colors.text,
          minHeight: 52,
          paddingHorizontal: 16,
        },
        genderRow: { flexDirection: 'row', gap: 12 },
        genderButton: {
          alignItems: 'center',
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          flex: 1,
          padding: 14,
        },
        genderSelected: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
        genderText: { ...theme.typography.button, color: theme.colors.text },
        continueButton: {
          alignItems: 'center',
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radius.sm,
          minHeight: 52,
          justifyContent: 'center',
        },
        continueText: { ...theme.typography.button, color: theme.isDark ? '#08111D' : '#FFFFFF' },
        disabled: { opacity: 0.6 },
      }),
    [theme],
  );

  const submit = async () => {
    const trimmedName = name.trim().replace(/\s+/g, ' ');
    const numericAge = Number(age);
    if (!trimmedName || trimmedName.length > 100) {
      Alert.alert('Check your name', 'Enter a name up to 100 characters.');
      return;
    }
    if (!/^\d{1,3}$/.test(age) || !Number.isInteger(numericAge) || numericAge < 18 || numericAge > 120) {
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
      Alert.alert('Unable to save profile', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={{ gap: 8 }}>
              <Text style={styles.title}>Complete Your Profile</Text>
              <Text style={styles.subtitle}>Tell us a little about yourself. You can update this later.</Text>
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                accessibilityLabel="Name"
                autoCapitalize="words"
                maxLength={100}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={theme.colors.textMuted}
                returnKeyType="next"
                style={styles.input}
                value={name}
              />
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                accessibilityLabel="Age"
                keyboardType="number-pad"
                maxLength={3}
                onChangeText={(value) => setAge(value.replace(/\D/g, ''))}
                placeholder="Your age (18+)"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={age}
              />
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.genderRow}>
                {(['male', 'female'] as const).map((value) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: gender === value }}
                    key={value}
                    onPress={() => setGender(value)}
                    style={[styles.genderButton, gender === value && styles.genderSelected]}
                  >
                    <Text style={styles.genderText}>{value === 'male' ? 'Male' : 'Female'}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={updateProfile.isPending}
              onPress={() => void submit()}
              style={[styles.continueButton, updateProfile.isPending && styles.disabled]}
            >
              <Text style={styles.continueText}>{updateProfile.isPending ? 'Saving...' : 'Continue'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
