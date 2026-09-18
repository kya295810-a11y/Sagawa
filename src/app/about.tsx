import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';

import { useAppTheme } from '@/theme/provider';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'newspaper-outline', label: 'News and public information' },
  { icon: 'swap-horizontal', label: 'MYR / MMK exchange-rate information' },
  { icon: 'grid-outline', label: 'Community and service information' },
  { icon: 'school-outline', label: 'Education and awareness content' },
];

const LEGAL_POINTS = [
  'Sagawa is an independent informational, educational, awareness, and technology case-study app.',
  'Sagawa does not promote, support, organize, encourage, or facilitate illegal activity.',
  'Users must follow the laws and regulations that apply in their country or location.',
  'Sagawa is not a government authority, bank, money-transfer company, immigration service, employment agency, or law-enforcement organization.',
  'Important legal, immigration, financial, employment, safety, or government information should be verified with official or qualified sources.',
];

export default function AboutScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  const openEmail = () => {
    Linking.openURL('mailto:sagawaap@gmail.com').catch(() => undefined);
  };

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
          Sagawa is an independent informational and educational mobile app created by Kyaw San Lin.
          It helps users access useful news, exchange-rate information, community services, and
          awareness content in one place.
        </Text>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>What Sagawa provides</Text>
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

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Our purpose</Text>
          <Text style={styles.bodyText}>Inform — Educate — Assist — Raise Awareness</Text>
          <Text style={styles.bodyText}>
            Sagawa is also a technology case-study project demonstrating mobile app development,
            APIs, databases, authentication, backend systems, security practices, and information
            delivery.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.noticeHeader}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.sectionTitleInline}>Legal & awareness notice</Text>
          </View>
          {LEGAL_POINTS.map((point) => (
            <View key={point} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bodyTextFlex}>{point}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Exchange-rate notice</Text>
          <Text style={styles.bodyText}>
            MYR/MMK exchange rates are provided for general information only. Rates may change,
            become delayed, or differ between providers. Sagawa does not itself provide banking,
            investment, currency-exchange, or money-transfer services. Always verify actual
            transaction rates with an authorized or licensed provider.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>News & service information</Text>
          <Text style={styles.bodyText}>
            News and service listings are provided to make useful information easier to access.
            Sagawa does not guarantee that every item is complete, current, official, licensed, or
            suitable for a particular decision. Verify important information independently.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Not professional advice</Text>
          <Text style={styles.bodyText}>
            Sagawa does not provide legal, immigration, financial, banking, investment, employment,
            medical, tax, or government advice. For important decisions, contact the appropriate
            official authority or qualified professional.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Privacy, legal terms & contact</Text>

          <Pressable style={styles.linkRow} onPress={() => router.push('/privacy-policy')}>
            <View style={styles.linkIcon}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.colors.text} />
            </View>
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>Privacy Policy</Text>
              <Text style={styles.linkSubtitle}>How Sagawa handles user information</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>

          <View style={styles.dividerWide} />

          <Pressable style={styles.linkRow} onPress={() => router.push('/terms')}>
            <View style={styles.linkIcon}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.text} />
            </View>
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>Terms & Legal Disclaimer</Text>
              <Text style={styles.linkSubtitle}>Rules, responsibilities, and legal notices</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>

          <View style={styles.dividerWide} />

          <Pressable style={styles.linkRow} onPress={openEmail}>
            <View style={styles.linkIcon}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.text} />
            </View>
            <View style={styles.linkTextWrap}>
              <Text style={styles.linkTitle}>sagawaap@gmail.com</Text>
              <Text style={styles.linkSubtitle}>Support, privacy, legal, or misuse reports</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Developer: Kyaw San Lin · kyawsanlin.com
        </Text>
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
      paddingBottom: 32,
      alignItems: 'center',
      gap: 14,
    },
    iconWrap: {
      width: 76,
      height: 76,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      marginTop: 12,
      marginBottom: 2,
    },
    appName: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
    },
    version: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: -8,
    },
    description: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      marginBottom: 2,
    },
    sectionCard: {
      alignSelf: 'stretch',
      overflow: 'hidden',
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 14,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 10,
    },
    sectionTitleInline: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    noticeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    featureRow: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
    },
    featureIconColumn: {
      width: 34,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    featureLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 34,
      backgroundColor: colors.border,
    },
    bodyText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 8,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 7,
    },
    bullet: {
      color: colors.primary,
      fontSize: 16,
      lineHeight: 21,
      width: 18,
    },
    bodyTextFlex: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    linkRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
    },
    linkIcon: {
      width: 34,
      alignItems: 'flex-start',
    },
    linkTextWrap: {
      flex: 1,
      paddingRight: 8,
    },
    linkTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    linkSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },
    dividerWide: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 34,
      backgroundColor: colors.border,
    },
    footer: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 4,
    },
  });
