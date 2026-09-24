import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/query-client';
import { clearAppCache, formatBytes, getCacheInfo } from '@/services/storage/cache-maintenance';
import { useAppTheme } from '@/theme/provider';

export default function SettingsScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);
  const [cacheSize, setCacheSize] = useState('—');
  const [clearing, setClearing] = useState(false);

  const refreshCacheSize = useCallback(async () => {
    const info = await getCacheInfo();
    setCacheSize(formatBytes(info.bytes));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshCacheSize();
    }, [refreshCacheSize]),
  );

  const clearCache = async () => {
    if (clearing) return;

    setClearing(true);
    try {
      const result = await clearAppCache();
      queryClient.clear();
      await refreshCacheSize();
      Alert.alert('Cache cleared', `${formatBytes(result.bytesBefore)} of temporary cache was cleared.`);
    } catch {
      Alert.alert('Unable to clear cache', 'Please try again.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style={theme.statusBarStyle} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={28} color={theme.colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>APP SETTINGS</Text>

        <View style={styles.card}>
          <Pressable
            onPress={() => router.push('/auto-update')}
            accessibilityRole="button"
            accessibilityLabel="Auto Update"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="cloud-download-outline" size={21} color={theme.colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Auto Update</Text>
              <Text style={styles.rowSubtitle}>Keep Sagawa current</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>

          <View style={styles.divider} />

          <View style={styles.cacheRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="trash-outline" size={21} color={theme.colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Clear Cache</Text>
              <Text style={styles.rowSubtitle}>Device app cache: {cacheSize}</Text>
            </View>
            <Pressable
              onPress={clearCache}
              disabled={clearing}
              accessibilityRole="button"
              accessibilityLabel="Clear Sagawa cache"
              style={({ pressed }) => [
                styles.clearButton,
                pressed && !clearing && styles.clearButtonPressed,
              ]}
            >
              <Text style={styles.clearButtonText}>{clearing ? 'Clearing…' : 'Clear'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={theme.colors.textMuted} />
          <Text style={styles.noteText}>
            Temporary cache is also cleaned automatically every 14 days. Clearing cache does not remove your account, profile, login, preferences, or biometric credentials.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    back: { width: 44, height: 44, justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '600' },
    headerSpacer: { width: 44 },
    content: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 40 },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.7,
      marginLeft: 12,
      marginBottom: 8,
    },
    card: {
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...Platform.select({ android: { elevation: 2 } }),
    },
    row: {
      minHeight: 78,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    cacheRow: {
      minHeight: 86,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    iconWrap: { width: 38 },
    rowText: { flex: 1, paddingRight: 12 },
    rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
    rowSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: 16, backgroundColor: colors.border },
    clearButton: {
      minWidth: 66,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    clearButtonPressed: { opacity: 0.78 },
    clearButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    note: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 18,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    noteText: { flex: 1, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
    pressed: { opacity: 0.72 },
  });
