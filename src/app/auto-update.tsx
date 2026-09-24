import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  checkForAppUpdate,
  getLastUpdateCheckAt,
  openAppStoreUpdate,
} from '@/services/updates/app-update';
import { useSettingsStore } from '@/store/settings-store';
import { useAppTheme } from '@/theme/provider';
import { env } from '@/config/env';

function formatLastChecked(value: string | null) {
  if (!value) return 'Not checked yet';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not checked yet';

  const today = new Date();
  const sameDay =
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate();

  return sameDay
    ? `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AutoUpdateScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);
  const enabled = useSettingsStore((state) => state.autoUpdateEnabled);
  const setEnabled = useSettingsStore((state) => state.setAutoUpdateEnabled);
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const refreshLastChecked = useCallback(async () => {
    setLastCheckedAt(await getLastUpdateCheckAt());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshLastChecked();
    }, [refreshLastChecked]),
  );

  const checkNow = async () => {
    if (checking) return;

    setChecking(true);
    try {
      const result = await checkForAppUpdate(true);
      await refreshLastChecked();

      if (!result?.available) {
        Alert.alert('Sagawa is up to date', `Version ${env.appVersion} is the latest version.`);
        return;
      }

      Alert.alert(
        'Update available',
        `Sagawa ${result.latestVersion} is ready to install.`,
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Update',
            onPress: () => {
              void openAppStoreUpdate(result.storeUrl).catch(() => {
                Alert.alert('Store unavailable', 'The app store link is not available yet.');
              });
            },
          },
        ],
      );
    } catch {
      Alert.alert('Unable to check for updates', 'Check your internet connection and try again.');
    } finally {
      setChecking(false);
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
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={27} color={theme.colors.primary} />
        </Pressable>

        <Text style={styles.headerTitle} allowFontScaling={false}>
          Auto Update
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.sectionLabel} allowFontScaling={false}>
          UPDATES
        </Text>

        <View style={styles.group}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="sync-outline" size={20} color={theme.colors.primary} />
            </View>

            <View style={styles.rowText}>
              <Text style={styles.rowTitle} allowFontScaling={false}>
                Automatic Updates
              </Text>
              <Text style={styles.rowSubtitle} allowFontScaling={false}>
                Check for new versions automatically
              </Text>
            </View>

            <Switch
              value={enabled}
              onValueChange={setEnabled}
              accessibilityLabel="Automatic Updates"
              accessibilityRole="switch"
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          <Pressable
            onPress={checkNow}
            disabled={checking}
            accessibilityRole="button"
            accessibilityLabel="Check for updates now"
            style={({ pressed }) => [
              styles.row,
              pressed && !checking && styles.pressed,
            ]}
          >
            <View style={styles.rowIcon}>
              {checking ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
              )}
            </View>

            <View style={styles.rowText}>
              <Text style={styles.rowTitle} allowFontScaling={false}>
                {checking ? 'Checking…' : 'Check for Updates Now'}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={17} color={theme.colors.textMuted} />
          </Pressable>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel} allowFontScaling={false}>
              Current Version
            </Text>
            <Text style={styles.infoValue} allowFontScaling={false}>
              {env.appVersion}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel} allowFontScaling={false}>
              Last Checked
            </Text>
            <Text style={styles.infoValue} allowFontScaling={false}>
              {formatLastChecked(lastCheckedAt)}
            </Text>
          </View>
        </View>

        <Text style={styles.footerText} allowFontScaling={false}>
          Sagawa checks for a new version at most once a day when Automatic Updates is on.
          Installation is handled securely by Google Play or the App Store.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: colors.text,
      fontSize: 17,
      fontWeight: '600',
    },
    headerSpacer: {
      width: 44,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 24,
      paddingBottom: 36,
    },
    sectionLabel: {
      marginLeft: 12,
      marginBottom: 8,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.4,
    },
    group: {
      overflow: 'hidden',
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    row: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    rowIcon: {
      width: 36,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    rowText: {
      flex: 1,
      minWidth: 0,
      paddingRight: 12,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '600',
    },
    rowSubtitle: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    infoRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      gap: 16,
    },
    infoLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    infoValue: {
      flexShrink: 1,
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'right',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 52,
      backgroundColor: colors.border,
    },
    footerText: {
      marginTop: 12,
      paddingHorizontal: 12,
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    pressed: {
      opacity: 0.6,
    },
  });
