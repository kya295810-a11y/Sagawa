import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '@/services/api/client';
import { clearBiometricCredential, hasBiometricCredential, saveBiometricCredential } from '@/services/auth/token-storage';
import { useAppTheme } from '@/theme/provider';

export default function BiometricSettingsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void hasBiometricCredential().then((value) => active && setEnabled(value));
    return () => { active = false; };
  }, []));

  const changeEnabled = async (next: boolean) => {
    if (busy) return;
    if (Platform.OS === 'web') {
      Alert.alert('Unavailable', 'Biometric login is available in the Android and iOS app.');
      return;
    }

    setBusy(true);
    try {
      if (next) {
        const response = await apiRequest<{ success: boolean; data: { credential: string } }>('/api/auth/biometric/enroll', {
          method: 'POST',
          body: JSON.stringify({ platform: Platform.OS }),
        });
        await saveBiometricCredential(response.data.credential);
        setEnabled(true);
      } else {
        try {
          await apiRequest('/api/auth/biometric', {
            method: 'DELETE',
            body: JSON.stringify({ platform: Platform.OS }),
          });
        } catch {
          // Local protected credential still needs to be removed when the user opts out.
        }
        await clearBiometricCredential();
        setEnabled(false);
      }
    } catch (error) {
      console.error('Biometric preference error:', error);
      Alert.alert('Unable to update biometric login', error instanceof Error ? error.message : 'Set up a device screen lock and biometric authentication, then try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style={theme.statusBarStyle} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Biometric Login</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={styles.heroIcon}>
            <Ionicons name="finger-print" size={32} color="#FFFFFF" />
          </View>
          <View style={styles.introText}>
            <Text style={styles.title}>Quick & secure</Text>
            <Text style={styles.description}>Unlock Sagawa with your device biometrics.</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}><Ionicons name="finger-print-outline" size={23} color={theme.colors.primary} /></View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Use Biometrics</Text>
              <Text style={styles.rowSubtitle}>{enabled ? 'Enabled on this device' : 'Use fingerprint, face or device biometrics'}</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={changeEnabled}
              disabled={busy}
              trackColor={{ false: theme.isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.isDark ? '#3A3A3C' : '#E5E5EA'}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.textMuted} />
            <Text style={styles.footnote}>Biometric data stays on your device.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  back: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '600' },
  headerSpacer: { width: 44 },
  content: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 40 },
  intro: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  heroIcon: { width: 62, height: 62, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } }, android: { elevation: 4 } }) },
  introText: { flex: 1, marginLeft: 16 },
  title: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, lineHeight: 15, fontWeight: '600', letterSpacing: 0.7, marginLeft: 12, marginBottom: 8 },
  card: { width: '100%', borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } }, android: { elevation: 2 } }) },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  rowIcon: { width: 38 },
  rowText: { flex: 1, paddingRight: 12 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16, backgroundColor: colors.border },
  infoRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, gap: 9 },
  footnote: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
});