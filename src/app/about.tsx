import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';

import { useAppTheme } from '@/theme/provider';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'newspaper-outline', label: 'Local news and updates' },
  { icon: 'swap-horizontal', label: 'Daily exchange rate' },
  { icon: 'grid-outline', label: 'Community services directory' },
];

export default function AboutScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={theme.statusBarStyle} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} allowFontScaling={false}>
          About Sagawa
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <Ionicons name="apps" size={40} color="#FFFFFF" />
        </View>

        <Text style={styles.appName}>Sagawa</Text>
        <Text style={styles.version}>Version {version}</Text>

        <Text style={styles.description}>
          Sagawa is a simple, useful mobile app built for the Sagawa community, bringing local
          news, exchange rates, and community services together in one place.
        </Text>

        <View style={styles.sectionCard}>
          {FEATURES.map((feature, index) => (
            <View key={feature.label}>
              <View style={styles.featureRow}>
                <View style={styles.featureIconColumn}>
                  <Ionicons name={feature.icon} size={20} color={theme.colors.text} />
                </View>
                <Text style={styles.featureLabel}>{feature.label}</Text>
              </View>
              {index < FEATURES.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: {
  background: string;
  surface: string;
  elevated: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
}) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    headerButton: { width: 32, alignItems: 'center', justifyContent: 'center' },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: colors.text,
      fontSize: 17,
      fontWeight: '600',
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 28,
      alignItems: 'center',
    },
    iconWrap: {
      width: 76,
      height: 76,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      marginTop: 12,
      marginBottom: 16,
    },
    appName: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
    },
    version: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 4,
      marginBottom: 18,
    },
    description: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      marginBottom: 24,
    },
    sectionCard: {
      alignSelf: 'stretch',
      overflow: 'hidden',
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    featureRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
    },
    featureIconColumn: {
      width: 34,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    featureLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 48,
      backgroundColor: colors.border,
    },
  });