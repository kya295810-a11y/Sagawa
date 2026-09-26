import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useRouter } from 'expo-router';

import { useAppTheme } from '@/theme/provider';

const sections = [
  ["Scope & acceptance", "These Terms apply to Sagawa users in Malaysia, Singapore, and Thailand. By creating an account or using Sagawa, you agree to these Terms and the Privacy Policy. Mandatory rights or protections that cannot legally be excluded under the law applying to you will continue to apply and will prevail over any inconsistent part of these Terms."],
  ["Eligibility", "You must be at least 18 years old to create a Sagawa account. You must provide information that is reasonably accurate and must not create an account for another person without lawful authority. Public Guest Mode content may be used without an account where the app permits it."],
  ["Purpose of Sagawa", "Sagawa is an independent informational, educational, awareness, and technology application intended to help users access useful news, exchange-rate information, service listings, public resources, and account-based features more conveniently."],
  ["Lawful use only", "You may use Sagawa only for lawful purposes. You are responsible for complying with the laws, regulations, licensing requirements, immigration rules, employment rules, financial rules, communications rules, and other legal requirements that apply to you in Malaysia, Singapore, Thailand, or any other place from which you access the service."],
  ["Prohibited use", "You must not use Sagawa for fraud, scams, money laundering, unlicensed remittance or currency dealing, illegal financial activity, human trafficking, exploitation, unlawful recruitment or employment arrangements, immigration evasion, identity theft, impersonation, harassment, unlawful content, cybercrime, unauthorized system access, credential theft, malware, denial-of-service activity, interference with Sagawa, or attempts to bypass lawful government, security, or platform requirements."],
  ["Country-specific compliance", "Sagawa is made available to users in Malaysia, Singapore, and Thailand, but it does not replace country-specific legal obligations. Malaysian users remain subject to applicable Malaysian law; Singapore users remain subject to applicable Singapore law; and Thai users remain subject to applicable Thai law. If a mandatory local law conflicts with these Terms, the mandatory local law controls to the extent of that conflict."],
  ["No government or institutional affiliation", "Unless Sagawa clearly states otherwise, Sagawa is not operated by, sponsored by, officially endorsed by, or acting on behalf of the governments or public authorities of Malaysia, Singapore, Thailand, or Myanmar; immigration authorities; embassies; police; banks; money-transfer companies; employers; recruitment or employment agencies; news organizations; or other third parties whose information may appear in the app."],
  ["Information only — not professional advice", "Content in Sagawa is provided for general informational, educational, and awareness purposes. It is not legal, immigration, financial, investment, banking, employment, tax, medical, or government advice. For decisions that may affect your rights, money, immigration status, employment, safety, or legal position, use an authorized professional or official source."],
  ["Exchange-rate & financial information", "Exchange rates and calculations shown by Sagawa are informational estimates and may be delayed, rounded, unavailable, or different from rates offered by banks, remittance providers, or other services. Sagawa does not itself accept money for exchange, perform remittances, operate as a bank, provide investment services, or act as a licensed foreign-exchange or money-transfer provider unless a future service is expressly introduced and legally authorized. Use appropriately licensed providers when a regulated service is required."],
  ["News & public information", "News and public-information items may come from administrators, public sources, external sources, or other appropriate information channels. Sagawa may summarize or present information for convenience but does not guarantee that every item is complete, error-free, current, official, or suitable for a particular decision. Important information should be checked against the relevant official or primary source."],
  ["Service listings & third parties", "A business, organization, provider, link, logo, rate, or service appearing in Sagawa does not by itself mean that Sagawa owns, operates, licenses, certifies, guarantees, or endorses it. Third parties operate independently. You should verify their identity, authorization, licensing, pricing, safety, availability, privacy practices, and contractual terms before dealing with them."],
  ["Account responsibilities", "You are responsible for protecting your device, password, email account, phone number, verification codes, and other authentication methods. Do not share one-time verification codes or login credentials with unauthorized persons. Tell Sagawa promptly if you reasonably believe your account or authentication method has been compromised."],
  ["Authentication & security controls", "Sagawa may use password checks, email or phone verification, Google Sign-In, device-protected biometric login, rate limits, session controls, fraud-prevention measures, and other reasonable security controls. Sagawa may require re-verification, revoke sessions or device credentials, or restrict suspicious activity when reasonably necessary to protect users or the service."],
  ["Privacy", "Sagawa's Privacy Policy forms part of these Terms and explains how personal data is handled. Privacy rights and obligations may differ between Malaysia, Singapore, and Thailand. Sagawa will apply mandatory data-protection requirements that apply to the relevant processing."],
  ["Suspension or termination", "Sagawa may suspend, restrict, or terminate an account or access when reasonably necessary to address suspected fraud, abuse, security threats, repeated violations of these Terms, unlawful activity, technical risk, or a valid legal requirement. Where applicable law requires notice, an opportunity to respond, or another procedure, Sagawa will follow that requirement."],
  ["Service availability & changes", "Sagawa may change, improve, discontinue, or temporarily suspend features. The service may also be unavailable because of maintenance, server or network issues, software updates, security incidents, third-party outages, legal requirements, or events outside reasonable control. Sagawa does not promise uninterrupted availability."],
  ["Intellectual property", "Unless otherwise stated, Sagawa branding, original software, interface design, and original content are owned by or licensed to the developer. Third-party names, trademarks, logos, images, articles, and other content remain the property of their respective owners and are used only where permitted or otherwise lawfully available."],
  ["Accuracy & disclaimers", "Sagawa makes reasonable efforts to provide useful and secure services, but information may contain mistakes, become outdated, or be unavailable. To the extent permitted by applicable law, the service and informational content are provided without guarantees that every item will always be accurate, current, uninterrupted, or fit for every user's specific purpose."],
  ["Limitation of liability & mandatory rights", "To the maximum extent permitted by applicable law, Sagawa and its developer are not liable for indirect, incidental, consequential, or special losses caused solely by reliance on general informational content or by third-party services outside Sagawa's control. Nothing in these Terms excludes or limits liability, consumer rights, privacy rights, or other remedies where the applicable law of Malaysia, Singapore, or Thailand does not permit that exclusion or limitation."],
  ["Unauthorized third-party conduct", "Illegal, misleading, or unauthorized conduct by a user, advertiser, provider, business, or other third party does not represent Sagawa's purpose, approval, or instructions. Sagawa may remove content, restrict access, preserve relevant security records, or cooperate with lawful requests where reasonably and legally appropriate."],
  ["Changes to these Terms", "These Terms may be updated when Sagawa features, business practices, security requirements, platform rules, or applicable laws change. The current version and effective date will be shown in the app or on Sagawa's official website. Where applicable law requires additional notice or consent for a material change, Sagawa will follow that requirement."],
  ["Severability & applicable mandatory law", "If a provision of these Terms is found unenforceable, the remaining provisions continue to apply to the extent permitted by law. These Terms do not select a court or governing law in a way that removes mandatory protections available to a user under applicable Malaysian, Singaporean, or Thai law."],
  ["Important final notice", "Sagawa exists to Inform — Educate — Assist — Raise Awareness. It does not exist to facilitate illegal activity or replace licensed or official services. Verify important information, use authorized providers where required, and follow the official requirements that apply in your location."],
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
        <Text style={styles.meta}>Effective: September 26, 2026 · Last updated: September 26, 2026</Text>
        <Text style={styles.intro}>
          By using Sagawa, you agree to use the application responsibly, protect your account, and comply with the laws that apply to you in Malaysia, Singapore, Thailand, or any other relevant jurisdiction.
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
