import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';

import { useAppTheme } from '@/theme/provider';

const sections = [
  ['About Sagawa', 'Sagawa is an independent informational, educational, awareness, and technology case-study application created by Kyaw San Lin. It may provide news, MYR/MMK exchange-rate information, community and service information, user accounts, Google Sign-In, notifications, and support features.'],
  ['Information we may collect', 'Depending on how you use Sagawa, we may process account information such as your name, email address, account identifier, profile information, profile image, information you submit, limited technical information, server logs, and notification tokens.'],
  ['Google Sign-In', 'If you use Google Sign-In, Google may provide information you authorize, such as your name, email address, profile picture, and Google account identifier. Sagawa does not receive or store your Google password.'],
  ['Guest Mode', 'Guest Mode lets you access public Sagawa content without creating an account. Sagawa stores only a local guest-mode preference on your device for this purpose. Guest Mode does not receive an account access token and cannot use private profile features.'],
  ['How information is used', 'Information may be used to create and manage accounts, authenticate users, provide app features, maintain profiles, deliver notifications, respond to support requests, improve reliability, diagnose technical problems, prevent abuse, protect users, maintain security, and comply with applicable legal obligations.'],
  ['Storage & security', 'Sagawa uses reasonable technical and organizational safeguards such as HTTPS, authentication controls, restricted database permissions, secure credential management, file-upload validation, server-side validation, rate limiting, logging, and monitoring. No internet-connected system can guarantee absolute security.'],
  ['Sharing of information', 'Sagawa does not sell users\' personal information. Limited information may be processed by technology providers that support authentication, hosting, databases, deployment, communications, notifications, analytics, security, or other technical infrastructure. Information may also be disclosed when legally required.'],
  ['Exchange-rate information', 'MYR/MMK exchange rates are provided for general informational purposes only. Rates may change, become delayed, or differ between providers. Sagawa does not itself provide banking, investment, currency-exchange, or money-transfer services unless a future service is explicitly introduced and legally authorized.'],
  ['News & service information', 'News and service listings are provided to make useful information easier to access. Sagawa does not guarantee that every item is complete, current, official, licensed, or suitable for a particular decision. Important information should be independently verified.'],
  ['Data retention', 'Personal information is retained only for as long as reasonably necessary to operate Sagawa, provide accounts, maintain security, resolve support issues, prevent abuse, and meet applicable legal obligations.'],
  ['Account & data deletion', 'You may request deletion of your Sagawa account and associated personal information through an in-app deletion feature when available or by contacting sagawaap@gmail.com. Some information may be retained where necessary for security, fraud prevention, dispute resolution, or legal compliance.'],
  ['Children\'s privacy', 'Sagawa does not intend to knowingly collect children\'s personal information in violation of applicable law. If such information is discovered to have been collected improperly, reasonable steps will be taken to remove it.'],
  ['Legal & awareness purpose', 'Sagawa is not created or operated for illegal activities. It does not promote, encourage, organize, support, or facilitate unlawful conduct. Users must follow the laws and regulations that apply in their country or location.'],
  ['Changes to this policy', 'This Privacy Policy may be updated when Sagawa features, technologies, legal requirements, or data practices change. The latest version will be shown in the app or on Sagawa\'s official website.'],
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={theme.statusBarStyle} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.meta}>Effective: September 18, 2026 · Last updated: September 18, 2026</Text>
        <Text style={styles.intro}>
          This Privacy Policy explains how Sagawa may collect, use, store, protect, and disclose information when you use the app.
        </Text>
        {sections.map(([title, body]) => (
          <View key={title} style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        ))}
        <View style={styles.card}>
          <Text style={styles.title}>Contact</Text>
          <Text style={styles.body}>Sagawa</Text>
          <Text style={styles.body}>Developer: Kyaw San Lin</Text>
          <Text style={styles.body}>Website: https://kyawsanlin.com</Text>
          <Text style={styles.body}>Email: sagawaap@gmail.com</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: { background: string; surface: string; border: string; text: string; textMuted: string; primary: string }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
    headerButton: { width: 32, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '600' },
    content: { padding: 16, paddingBottom: 32 },
    meta: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
    intro: { color: colors.text, fontSize: 15, lineHeight: 22, marginBottom: 14 },
    card: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14, marginBottom: 12 },
    title: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
    body: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  });
