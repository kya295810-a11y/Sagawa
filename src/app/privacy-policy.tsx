import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';

import { useAppTheme } from '@/theme/provider';

const sections = [
  ["Scope & applicable privacy laws", "This Privacy Policy applies to Sagawa users in Malaysia, Singapore, and Thailand. Sagawa is operated by Kyaw San Lin. Depending on where a user is located and where processing takes place, Sagawa handles personal data with the intention of meeting applicable requirements under Malaysia's Personal Data Protection Act 2010 as amended, Singapore's Personal Data Protection Act 2012, Thailand's Personal Data Protection Act B.E. 2562 (2019), and other mandatory local requirements. If a mandatory local rule gives you greater protection, that rule prevails."],
  ["Information we collect", "Depending on how you use Sagawa, we may process your name, date of birth, age, country, state or province, city or general location, gender if you choose to provide it, email address or phone number, account identifier, profile image, support messages or other information you submit, and records needed to operate and secure your account."],
  ["Authentication & verification", "Sagawa may use email or phone verification codes, password authentication, account and session identifiers, security records, and verification-attempt information to create accounts and protect sign-in. Passwords are not stored in plain text; the service stores a one-way password hash. Verification codes and related security records are retained only as needed for authentication, abuse prevention, and security."],
  ["Google Sign-In", "If you choose Google Sign-In, Google may provide information you authorize, such as your name, email address, profile information, and Google account identifier. Sagawa does not receive or store your Google password. Google processes information under its own terms and privacy practices."],
  ["Biometric login", "When you enable fingerprint, Face ID, or another supported device biometric, the biometric check is performed by your device operating system. Sagawa does not receive or store your fingerprint, face template, or other biometric template. A revocable login credential is protected on the device using secure storage, while the server stores only the corresponding protected or hashed credential needed to recognize the device login."],
  ["Guest Mode", "Guest Mode lets you access public Sagawa content without creating an account. A local guest-mode preference may be stored on your device. Guest Mode does not receive an authenticated account access token and cannot use private account features."],
  ["Device, logs & analytics", "To operate, secure, diagnose, and improve Sagawa, limited technical information may be processed, such as device platform, app or request information, network or server logs, security events, and pseudonymous or hashed analytics identifiers. Sagawa may record content views or interactions to understand reach and reliability without intentionally using those analytics identifiers as your public identity."],
  ["Push notifications", "If you allow notifications, Sagawa may process a push-notification token, device platform, and notification preference so that news, service, exchange-rate, security, or other permitted app notifications can be delivered. You can disable notifications in Sagawa or through your device settings."],
  ["How we use information", "Personal data may be used to create and manage accounts, verify identity and contact methods, provide profile and app features, deliver requested notifications, respond to support requests, measure content performance, prevent fraud or abuse, maintain security, diagnose technical problems, enforce these Terms, comply with legal obligations, and improve Sagawa."],
  ["Legal bases and consent", "The legal basis for processing depends on the country, the feature, and the circumstances. Processing may rely on your consent, steps you request in order to use an account or service, performance of the service relationship, legitimate interests where permitted, or compliance with legal obligations. Where consent is legally required, you may withdraw it subject to applicable law and any technical consequences of disabling the related feature."],
  ["Sharing & service providers", "Sagawa does not sell personal data. Limited data may be processed by service providers supporting hosting, databases, authentication, email or SMS delivery, Google Sign-In, push notifications, cloud storage, deployment, security, analytics, or similar infrastructure. Providers should receive only information reasonably needed for their role and may also be subject to their own legal obligations. Personal data may also be disclosed when required by law, court order, or a competent authority."],
  ["Cross-border processing", "Because Sagawa and its technology providers may use infrastructure in more than one country, personal data may be processed or stored outside the country where you live. Where cross-border transfer rules apply, Sagawa will take reasonable steps intended to use lawful transfer mechanisms and safeguards required by the applicable laws of Malaysia, Singapore, or Thailand."],
  ["Data retention", "Personal data is retained only for as long as reasonably necessary for the purpose for which it was collected, account operation, security, fraud and abuse prevention, dispute handling, technical recovery, or applicable legal requirements. Data that is no longer reasonably required will be deleted, anonymized, or otherwise handled as required by applicable law and operational constraints."],
  ["Security", "Sagawa uses reasonable technical and organizational safeguards appropriate to the service, including HTTPS, authentication controls, restricted permissions, secure credential handling, server-side validation, upload validation, rate limiting, and security logging. No internet-connected service can guarantee absolute security."],
  ["Your privacy rights — Malaysia", "Subject to the Malaysian Personal Data Protection Act and applicable exceptions, Malaysian users may have rights to receive information about processing, request access to and correction of personal data, withdraw consent where processing relies on consent, limit certain processing, object to or prevent certain direct-marketing use, and exercise other rights available under applicable Malaysian law."],
  ["Your privacy rights — Singapore", "Subject to the Singapore Personal Data Protection Act and applicable exceptions, Singapore users may request access to certain personal data and information about its use or disclosure, request correction of errors or omissions, withdraw consent where consent is relied on, and raise privacy questions or complaints. Sagawa also applies retention, protection, and overseas-transfer safeguards as required by applicable Singapore law."],
  ["Your privacy rights — Thailand", "Subject to Thailand's Personal Data Protection Act and applicable conditions or exceptions, Thai users may have rights to access and obtain copies of personal data, correct inaccurate data, request erasure or restriction, object to certain processing, request data portability where applicable, withdraw consent, and lodge a complaint with the competent authority."],
  ["Personal data breaches", "If Sagawa becomes aware of a personal-data breach, it will assess the incident and take reasonable containment and remediation steps. Where applicable law requires notification to a regulator or affected individuals, Sagawa will make the required notification within the legally required period and provide the information required by law."],
  ["Account & data deletion", "You may request deletion of your Sagawa account and associated personal data through an in-app deletion feature when available or by contacting sagawaap@gmail.com. Deletion requests are subject to identity verification and applicable exceptions. Certain records may be retained where reasonably necessary for security, fraud prevention, dispute resolution, backup integrity, or legal compliance."],
  ["Age requirement", "Sagawa currently requires a user to be at least 18 years old to create an account. Sagawa does not knowingly permit account registration by children under 18. If Sagawa learns that an account was created in violation of this requirement, reasonable steps may be taken to restrict or remove the account and associated data, subject to applicable law."],
  ["Exchange-rate, news & service content", "Exchange-rate information, news, and service listings are provided for general informational purposes. Rates may change or differ between providers, and listings or news may become outdated. Sagawa does not itself provide banking, investment, currency-exchange, money-transfer, immigration, employment-agency, or legal services unless a future service is clearly introduced and legally authorized."],
  ["Changes to this policy", "This Privacy Policy may be updated when Sagawa features, data practices, service providers, platform requirements, or applicable laws change. The current version and its effective date will be shown in the app or on Sagawa's official website. Where required by law, additional notice or consent will be obtained before a material change takes effect."],
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
        <Text style={styles.meta}>Effective: September 26, 2026 · Last updated: September 26, 2026</Text>
        <Text style={styles.intro}>
          This Privacy Policy explains how Sagawa handles personal data for users in Malaysia, Singapore, and Thailand, including the information processed, why it is used, how it is protected, and the rights that may apply to you.
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
