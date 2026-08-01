// Settings info pages (FAQ / Contact / Terms / Privacy / Guidelines /
// Safety tips) — chrome matches the redesigned Settings screen: back
// chevron + 24pt condensed title, flat hairline-divided sections,
// 14.5pt Barlow body. Content stays keyed off `pageKey`.
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily } from '../theme';

const INFO_PAGES = {
  email: {
    title: 'Email',
    sections: [
      {
        heading: 'Primary Email',
        body: 'support@junubin.app',
      },
      {
        heading: 'Support Hours',
        body: 'Monday to Friday, 9:00 AM - 6:00 PM',
      },
    ],
  },
  faq: {
    title: 'FAQ',
    sections: [
      {
        heading: 'How do connections work?',
        body: 'JuNubin has no matching or swiping. Follow people you find on the map or in the Directory — when someone follows you back you are connected. Anyone else can reach you only through a message request that you accept or decline.',
      },
      {
        heading: 'How do filters work?',
        body: 'On the Directory tab, filter people by city, background, language, what they are open to, and verification. Every filter is free.',
      },
      {
        heading: 'How do I connect with someone?',
        body: 'Follow them. If they follow you back you are connected and can message each other directly. If you are not connected yet, send a message request — they choose whether to accept it.',
      },
      {
        heading: 'Who can see where I am?',
        body: 'Nobody, unless you choose otherwise. Location visibility is off by default. You can switch it to city-only, or to an approximate area accurate to about a kilometre, in Settings → Privacy. Your exact address is never shared.',
      },
    ],
  },
  contact: {
    title: 'Contact Us',
    sections: [
      {
        heading: 'Support',
        body: 'support@junubin.app',
      },
      {
        heading: 'Business',
        body: 'partnerships@junubin.app',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    subtitle: 'Last updated: May 4, 2026',
    sections: [
      {
        heading: '1. Acceptance',
        body: 'By creating an account or using JuNubin ("the app"), you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use the app. We may update these Terms from time to time; continued use after a change means you accept the updated Terms.',
      },
      {
        heading: '2. Eligibility',
        body: 'JuNubin is for adults aged 18 or older. By using the app you confirm you are at least 18, can lawfully enter into a binding contract, and are not barred from using the service under the laws of your country. Accounts found to belong to minors will be terminated immediately.',
      },
      {
        heading: '3. Your Account',
        body: 'You are responsible for everything that happens under your account, including keeping your password and login codes private. Use real photos and accurate profile details. One person, one account — impersonation, fake profiles, and shared accounts are prohibited.',
      },
      {
        heading: '4. Acceptable Use',
        body: 'You agree not to: (a) harass, threaten, or intimidate other users; (b) post or share illegal, hateful, sexually explicit, or abusive content; (c) impersonate anyone or misrepresent your affiliation; (d) solicit money, run scams, or post commercial spam; (e) use the app to contact minors; (f) reverse-engineer, scrape, or copy any part of the service; (g) use bots, automation, or VPN spoofing to manipulate discovery, location, or popularity. Violations may result in immediate suspension or permanent ban.',
      },
      {
        heading: '5. Content You Share',
        body: 'You retain ownership of photos, profile content, messages, and other content you upload ("Your Content"). By uploading Your Content, you grant JuNubin a worldwide, non-exclusive, royalty-free license to host, display, and transmit Your Content as needed to operate the service. We do not sell Your Content. You can remove Your Content at any time by deleting it in the app or deleting your account.',
      },
      {
        heading: '6. Subscriptions & Auto-Renewal',
        body: 'JuNubin does not sell subscriptions. There is nothing to renew, cancel, or refund. If you subscribed before JuNubin became free, manage or cancel that legacy subscription through the platform that processed it — your App Store or Google Play account settings, or the Stripe customer portal.',
      },
      {
        heading: '7. Virtual Items',
        body: 'JuNubin is free. There are no subscriptions, no in-app purchases and no virtual goods, so nothing on the service is sold to you and nothing needs to be refunded.',
      },
      {
        heading: '8. Safety & Reporting',
        body: 'JuNubin is a community, not an introduction agency. We do not run criminal background checks on users. Always meet new people in public, share your plans with someone you trust, and never send money to someone you met here. Use the in-app report and block tools when something feels unsafe. We may share information with law enforcement if required by law.',
      },
      {
        heading: '9. No Screenshots or Screen Recording',
        body: 'JuNubin blocks screen capture and recording across the app. If a screenshot attempt is detected, the app will lock and warn you. Repeated attempts may lead to account restrictions. This is to protect everyone\'s privacy — content shared in JuNubin stays in JuNubin.',
      },
      {
        heading: '10. Termination',
        body: 'You can delete your account at any time from Settings → Account. We may suspend or terminate your account if we reasonably believe you have violated these Terms or that your continued use puts other users at risk. On termination, your access ends; we may retain limited data as required by law or for safety/fraud prevention.',
      },
      {
        heading: '11. Disclaimers & Limitation of Liability',
        body: 'JuNubin is provided "as is" without warranties of any kind. We do not guarantee that you will find the people you are looking for, that profiles are accurate, or that the service will be uninterrupted. To the maximum extent permitted by law, JuNubin\'s total liability arising out of your use of the service is limited to the greater of (a) the amount you paid us in the twelve months before the claim, or (b) US $50.',
      },
      {
        heading: '12. Governing Law',
        body: 'These Terms are governed by the laws of the State of Texas, USA, excluding its conflict-of-laws rules. Disputes will be resolved in the state or federal courts located in Harris County, Texas, unless your local consumer-protection law gives you the right to bring a claim where you live.',
      },
      {
        heading: '13. Contact',
        body: 'Questions about these Terms? Email support@junubin.app.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'Last updated: May 4, 2026',
    sections: [
      {
        heading: '1. Who We Are',
        body: 'JuNubin is a free social networking app for the South Sudanese community and diaspora — it helps you find, follow and message other South Sudanese people near you or in a city you care about. This Privacy Policy explains what data we collect, how we use it, who we share it with, and your rights. By using JuNubin you agree to this Policy.',
      },
      {
        heading: '2. Data You Give Us',
        body: 'When you sign up: phone number or email, name, date of birth, gender, photos, and profile fields you choose to fill (e.g. city, background, languages, profession, interests, what you are open to). When you use the app: text messages you send, who you follow, message requests, reports you submit, and — only if you turn location visibility on — a coarse location accurate to roughly a kilometre. We do not collect precise location, we do not collect location in the background, and we never sell it or use it for ad targeting. JuNubin is free, so we collect no billing information at all.',
      },
      {
        heading: '3. Data Collected Automatically',
        body: 'Device type, OS version, app version, language, push-notification token, anonymous usage analytics (which screens you visit, errors), and approximate IP-based location. With your explicit permission only: camera (only to take profile photos or verify your identity), photo library (only to upload profile photos), contacts (only when you choose Find Friends). JuNubin never asks for microphone access and never reads precise device location — coordinates are coarsened before they are stored or shown.',
      },
      {
        heading: '4. How We Use Your Data',
        body: 'To create and protect your account; to power people discovery (the map and the Directory); to deliver messages and notifications; to detect fake profiles, fraud, and abuse; to comply with legal obligations; to improve the app through aggregated analytics. We do NOT sell your data to advertisers and we do NOT show third-party ads.',
      },
      {
        heading: '5. Who We Share Data With',
        body: 'Service providers acting on our behalf: Supabase (database + storage + auth), Expo (push notifications and over-the-air updates), and Apple/Google (push notification delivery). JuNubin is free — no payment processor receives data from the app. (Legacy pre-free-era subscriptions were processed by RevenueCat and Stripe; those providers retain only the records needed for their own legal obligations.) We share only what each provider needs to perform its function. We may also disclose information when required by law, to protect user safety, or in connection with a merger or acquisition (you would be notified).',
      },
      {
        heading: '6. International Transfers',
        body: 'Your data may be processed in the United States and other countries where our service providers operate. By using JuNubin you consent to these transfers. We use providers that maintain appropriate safeguards (e.g. Standard Contractual Clauses) for transfers from the EU/UK.',
      },
      {
        heading: '7. Data Retention',
        body: 'We keep account data while your account is active. When you delete your account, profile data, photos, and conversations are deleted within 30 days; some records (e.g. fraud signals, abuse reports) may be retained for up to seven years to meet legal, accounting, and safety obligations.',
      },
      {
        heading: '8. Your Rights',
        body: 'Depending on where you live (GDPR, UK GDPR, CCPA, or similar), you have the right to: (a) access the data we hold about you; (b) correct inaccurate data; (c) delete your data; (d) export a copy of your data; (e) object to or restrict certain processing; (f) withdraw consent for optional permissions (camera, location, contacts) at any time in your device settings. Email support@junubin.app to exercise any of these rights — we will respond within 30 days.',
      },
      {
        heading: '9. How to Delete Your Account',
        body: 'In the app: Settings → Account → Delete Account. We will confirm by email/SMS and complete deletion within 30 days.',
      },
      {
        heading: '10. Security',
        body: 'We use TLS for data in transit, encrypted storage at rest via our cloud providers, row-level security on our database, hashed passwords, and one-time codes for sensitive actions. The app blocks screenshots and screen recording everywhere — content shared inside JuNubin cannot be captured by other users. No system is perfect; if we ever experience a data breach affecting you, we will notify you as required by law.',
      },
      {
        heading: '11. Children',
        body: 'JuNubin is for users 18 and older. We do not knowingly collect data from anyone under 18. If you believe a minor has created an account, please email support@junubin.app and we will remove the account immediately.',
      },
      {
        heading: '12. Cookies and Web',
        body: 'If you visit junubin.app on the web (e.g. for Stripe checkout or password reset), we use only essential cookies needed to operate the page — no advertising or third-party tracking cookies.',
      },
      {
        heading: '13. Changes to This Policy',
        body: 'We may update this Policy as the app evolves. Material changes will be communicated through the app and/or email at least 14 days before they take effect. The "Last updated" date at the top reflects the most recent change.',
      },
      {
        heading: '14. Contact Us',
        body: 'Privacy questions or rights requests: privacy@junubin.app or support@junubin.app. For users in the EU/UK, you also have the right to lodge a complaint with your local data-protection authority.',
      },
    ],
  },
  guidelines: {
    title: 'Community Guidelines',
    sections: [
      {
        heading: 'Be Respectful',
        body: 'Communicate with kindness. Hate speech, threats, and abusive behavior are not allowed.',
      },
      {
        heading: 'Be Authentic',
        body: 'Use real photos and accurate profile details.',
      },
      {
        heading: 'Keep It Safe',
        body: 'Do not share harmful content, scams, or explicit material without consent.',
      },
    ],
  },
  safety: {
    title: 'Safety Tips',
    sections: [
      {
        heading: 'Meet in Public',
        body: 'Choose a public place for first meetings and let someone you trust know where you are.',
      },
      {
        heading: 'Protect Personal Info',
        body: 'Avoid sharing financial details, home address, or sensitive private data early.',
      },
      {
        heading: 'Report Issues',
        body: 'Use in-app reporting and blocking when something feels unsafe or suspicious.',
      },
    ],
  },
};

export default function SettingsInfoScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const pageKey = route?.params?.pageKey || 'faq';
  const page = INFO_PAGES[pageKey] || INFO_PAGES.faq;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{page.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {page.subtitle ? (
          <Text style={styles.subtitle}>{page.subtitle}</Text>
        ) : null}
        {page.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 24,
    color: colors.black,
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 30,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: colors.gray400,
    marginBottom: 4,
  },
  section: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  sectionHeading: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    color: colors.black,
    marginBottom: 6,
  },
  sectionBody: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.gray500,
  },
});
