import React from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';

import { useAppTheme } from '@/theme/provider';

const SAGAWA_ABOUT_LOGO = 'data:image/png;base64,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';

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
        <Image
          source={{ uri: SAGAWA_ABOUT_LOGO }}
          style={styles.aboutLogo}
          resizeMode="contain"
          accessibilityLabel="Sagawa flower logo"
        />

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
    aboutLogo: {
      width: 64,
      height: 64,
      marginTop: 10,
      marginBottom: 6,
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
