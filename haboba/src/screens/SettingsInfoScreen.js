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
import { useTheme, Typography, FontFamily, getShadow } from '../theme';

const INFO_PAGES = {
  email: {
    title: 'Email',
    sections: [
      {
        heading: 'Primary Email',
        body: 'support@eastside.app',
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
        heading: 'How does matching work?',
        body: 'When both people like each other, a match is created and chat is unlocked.',
      },
      {
        heading: 'How do filters work?',
        body: 'Use Dating Preferences to tune age, distance, intentions, and other profile criteria.',
      },
      {
        heading: 'Can I undo a swipe?',
        body: 'Rewind is available with JuNubin+ and above.',
      },
    ],
  },
  contact: {
    title: 'Contact Us',
    sections: [
      {
        heading: 'Support',
        body: 'support@eastside.app',
      },
      {
        heading: 'Business',
        body: 'partnerships@eastside.app',
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    sections: [
      {
        heading: 'Usage',
        body: 'Use JuNubin respectfully. Harassment, impersonation, and illegal activity are prohibited.',
      },
      {
        heading: 'Account',
        body: 'You are responsible for maintaining the confidentiality and safety of your account.',
      },
      {
        heading: 'Subscriptions',
        body: 'Paid features renew as described at checkout and can be managed in settings.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        heading: 'Data We Use',
        body: 'We process profile and activity data to provide matching, messaging, and safety features.',
      },
      {
        heading: 'Data Control',
        body: 'You can update profile details and preferences at any time from Settings.',
      },
      {
        heading: 'Security',
        body: 'We apply technical and procedural safeguards to protect account information.',
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
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const pageKey = route?.params?.pageKey || 'faq';
  const page = INFO_PAGES[pageKey] || INFO_PAGES.faq;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{page.title}</Text>
        <View style={styles.rightSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {page.sections.map((section) => (
          <View key={section.heading} style={styles.card}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
    backgroundColor: colors.white,
  },
  headerTitle: {
    ...Typography.screenTitle,
    color: colors.black,
  },
  rightSpacer: {
    width: 24,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...getShadow('sm', isDark),
  },
  sectionHeading: {
    ...Typography.bodySemibold,
    color: colors.black,
    fontFamily: FontFamily.bold,
    marginBottom: 6,
  },
  sectionBody: {
    ...Typography.bodySmall,
    color: colors.gray600,
    lineHeight: 21,
  },
});
