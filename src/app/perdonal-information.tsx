import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfile, useUpdateProfile } from '@/features/profile/hooks';
import { useAppTheme } from '@/theme/provider';

type Gender = 'male' | 'female';

export default function PersonalInformationScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [location, setLocation] = useState('');
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  const resetDraft = () => {
    const profile = profileQuery.data;
    if (!profile) return;
    setName(profile.name);
    setAge(profile.age?.toString() ?? '');
    setGender(profile.gender ?? 'male');
    setLocation(profile.location);
  };

  const save = async () => {
    const trimmedName = name.trim().replace(/\s+/g, ' ');
    const numericAge = Number(age);
    if (!trimmedName || trimmedName.length > 100) {
      Alert.alert('Check your name', 'Enter a name up to 100 characters.');
      return;
    }
    if (!/^\d{1,3}$/.test(age) || !Number.isInteger(numericAge) || numericAge < 13 || numericAge > 120) {
      Alert.alert('Check your age', 'Enter a whole number between 13 and 120.');
      return;
    }
    if (location.trim().length > 120) {
      Alert.alert('Check your location', 'Location must be 120 characters or fewer.');
      return;
    }
    try {
      await updateProfile.mutateAsync({
        name: trimmedName,
        age: numericAge,
        gender,
        location: location.trim().replace(/\s+/g, ' '),
      });
      setEditing(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const profile = profileQuery.data;
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={theme.statusBarStyle} />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Personal Information</Text>
        {profile && !editing ? (
          <Pressable accessibilityLabel="Edit profile" hitSlop={10} onPress={() => { resetDraft(); setEditing(true); }} style={styles.headerButton}>
            <Ionicons name="pencil" size={20} color={theme.colors.primary} />
          </Pressable>
        ) : <View style={styles.headerButton} />}
      </View>

      {profileQuery.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>
      ) : profileQuery.isError || !profile ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Unable to load your profile.</Text>
          <Pressable onPress={() => void profileQuery.refetch()} style={styles.primaryButton}><Text style={styles.primaryText}>Retry</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {editing ? (
            <View style={styles.card}>
              <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" maxLength={100} styles={styles} />
              <Field label="Age" value={age} onChangeText={(value) => setAge(value.replace(/\D/g, ''))} placeholder="Your age" keyboardType="number-pad" maxLength={3} styles={styles} />
              <Text style={styles.label}>Gender</Text>
              <View style={styles.genderRow}>
                {(['male', 'female'] as const).map((value) => (
                  <Pressable accessibilityRole="radio" accessibilityState={{ checked: gender === value }} key={value} onPress={() => setGender(value)} style={[styles.genderButton, gender === value && styles.genderSelected]}>
                    <Text style={styles.value}>{value === 'male' ? 'Male' : 'Female'}</Text>
                  </Pressable>
                ))}
              </View>
              <Field label="Location (optional)" value={location} onChangeText={setLocation} placeholder="City or region" maxLength={120} styles={styles} />
              <View style={styles.actions}>
                <Pressable disabled={updateProfile.isPending} onPress={() => { resetDraft(); setEditing(false); }} style={styles.secondaryButton}><Text style={styles.value}>Cancel</Text></Pressable>
                <Pressable disabled={updateProfile.isPending} onPress={() => void save()} style={styles.primaryButton}><Text style={styles.primaryText}>{updateProfile.isPending ? 'Saving...' : 'Save'}</Text></Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <InfoRow icon="person-outline" label="Name" value={profile.name} styles={styles} color={theme.colors.text} />
              <InfoRow icon="calendar-outline" label="Age" value={profile.age?.toString() || 'Not set'} styles={styles} color={theme.colors.text} />
              <InfoRow icon="people-outline" label="Gender" value={profile.gender === 'male' ? 'Male' : 'Female'} styles={styles} color={theme.colors.text} />
              <InfoRow icon="location-outline" label="Location" value={profile.location || 'Not set'} styles={styles} color={theme.colors.text} />
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Field({ label, styles, ...props }: { label: string; styles: ReturnType<typeof createStyles> } & React.ComponentProps<typeof TextInput>) {
  return <View style={{ gap: 8 }}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor={styles.muted.color} style={styles.input} /></View>;
}

function InfoRow({ icon, label, value, styles, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; styles: ReturnType<typeof createStyles>; color: string }) {
  return <View style={styles.infoRow}><Ionicons name={icon} size={20} color={color} /><View style={{ flex: 1 }}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View></View>;
}

const createStyles = (colors: { background: string; surface: string; border: string; text: string; textMuted: string; primary: string; primarySoft: string }) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  headerButton: { width: 36, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  content: { padding: 16, paddingBottom: 32 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: 18, padding: 18 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  value: { color: colors.text, fontSize: 16, marginTop: 3 },
  muted: { color: colors.textMuted, textAlign: 'center' },
  input: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 50, paddingHorizontal: 14 },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderButton: { flex: 1, alignItems: 'center', borderColor: colors.border, borderRadius: 12, borderWidth: 1, padding: 13 },
  genderSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  infoRow: { alignItems: 'center', flexDirection: 'row', gap: 14, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 14 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 12, flex: 1, paddingHorizontal: 18, paddingVertical: 14 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 12, borderWidth: 1, flex: 1, paddingVertical: 11 },
});
