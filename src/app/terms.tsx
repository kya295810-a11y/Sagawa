import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';

import { useAppTheme } from '@/theme/provider';

const sections = [
  ['Purpose of Sagawa', 'Sagawa is an independent informational, educational, awareness, and technology case-study application. It is designed to help users access useful news, exchange-rate information, service information, educational content, and other public resources more conveniently.'],
  ['Lawful use only', 'Sagawa does not promote, encourage, support, organize, or facilitate unlawful activity. Users must comply with applicable laws, rules, and regulations in their country or jurisdiction.'],
  ['Prohibited use', 'Sagawa must not be used for fraud, scams, money laundering, unauthorized money transfers, illegal currency transactions, human trafficking, exploitation, illegal employment arrangements, immigration violations, identity theft, cybercrime, unauthorized system access, malware distribution, or attempts to bypass lawful government requirements.'],
  ['No government affiliation', 'Unless clearly stated otherwise, Sagawa is not affiliated with, operated by, sponsored by, or officially endorsed by the governments of Malaysia or Myanmar, immigration authorities, embassies, police, banks, money-transfer companies, employment agencies, news organizations, or other public authorities.'],
  ['Information only — not professional advice', 'Information in Sagawa is provided for general informational, educational, and awareness purposes only. Sagawa does not provide legal, immigration, financial, investment, banking, employment, medical, tax, or government advice.'],
  ['Exchange-rate disclaimer', 'Rates shown in Sagawa may change, be delayed, or differ between providers. Unless explicitly introduced in the future through a legally authorized service, Sagawa does not itself exchange currency, receive money for exchange, transfer money, provide banking services, provide investment services, or act as a licensed financial institution.'],
  ['News disclaimer', 'News may come from publicly available sources, administrators, external sources, or other appropriate information sources. Sagawa does not guarantee that every item is complete, error-free, current, official, or suitable for a particular decision.'],
  ['Service information disclaimer', 'A listing in Sagawa does not automatically mean that Sagawa owns, operates, guarantees, licenses, certifies, or endorses that service. Users should independently verify identity, licensing, legal status, pricing, safety, availability, contact details, and terms.'],
  ['Accuracy of information', 'Sagawa makes reasonable efforts to provide useful information, but information may contain errors, become outdated, be incomplete, change without notice, become unavailable, or differ from official sources.'],
  ['User responsibility', 'Users are responsible for how they use information obtained through Sagawa and for complying with applicable local law, immigration rules, employment rules, financial regulations, tax requirements, government requirements, and other legal obligations.'],
  ['Third-party links & services', 'Third-party websites, applications, organizations, businesses, or services operate independently from Sagawa. Sagawa does not control all third-party content, privacy practices, security, pricing, availability, services, or terms.'],
  ['Service availability', 'Sagawa may sometimes be unavailable because of maintenance, server issues, connectivity problems, software updates, security incidents, third-party outages, technical failures, or events outside reasonable control.'],
  ['Security', 'Sagawa uses reasonable security measures, but no internet-connected application can guarantee complete protection from every possible incident. Users are responsible for protecting their own devices, email accounts, and authentication information.'],
  ['Limitation of liability', 'To the maximum extent permitted by applicable law, Sagawa and its developer are not responsible for indirect, incidental, consequential, or special losses arising solely from reliance on general informational content. Nothing in these Terms limits liability where the law does not permit that limitation.'],
  ['Unauthorized third-party conduct', 'Illegal or unauthorized conduct by a user or third party does not represent Sagawa\'s purpose, policies, approval, or intentions. Where legally and technically reasonable, Sagawa may take action against misuse.'],
  ['Intellectual property', 'Unless otherwise stated, Sagawa branding, original software, interface design, and original content are owned by or licensed to the developer. Third-party trademarks, names, images, and content remain the property of their respective owners.'],
  ['Changes to these Terms', 'These Terms may be updated when Sagawa features, technology, platform rules, or legal requirements change. The latest version will be shown in the app or on the official website.'],
  ['Important final notice', 'Sagawa exists to Inform — Educate — Assist — Raise Awareness. It does not exist to facilitate illegal activity. Users should respect the law, verify important information, use authorized and licensed services where required, and follow official government requirements.'],
];

export default function TermsScreen() {
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
        <Text style={styles.headerTitle}>Terms & Legal Disclaimer</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.meta}>Effective: September 18, 2026 · Last updated: September 18, 2026</Text>
        <Text style={styles.intro}>
          By using Sagawa, you agree to use the application responsibly and in accordance with applicable laws.
        </Text>
        {sections.map(([title, body]) => (
          <View key={title} style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        ))}
        <View style={styles.card}>
          <Text style={styles.title}>Contact</Text>
          <Text style={styles.body}>
            Sagawa{'
'}Developer: Kyaw San Lin{'
'}Website: https://kyawsanlin.com{'
'}Email: sagawaap@gmail.com
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: { background: string; surface: string; border: string; text: string; textMuted: string }) =>
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
