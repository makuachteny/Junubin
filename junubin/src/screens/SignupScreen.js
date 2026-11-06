// ═══════════════════════════════════════════════════════════
// JuNubin — Sign in with phone ("Industry" redesign, design.html
// Phone + OTP screens). Two steps on the theme background:
//   phone → country prefix + tel input + Blueprint gold SEND CODE
//   otp   → six code boxes + in-app 3×4 keypad, auto-verifies at 6
// Auth is Supabase phone OTP via useAuth().startOtp / loginWithOtp.
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily } from '../theme';
import Blueprint from '../components/Blueprint';
import { useAuth } from '../auth';
import { validatePhoneDigits } from '../utils/validators';
import { devAuthBypassEnabled } from '../config/devAuth';
import { trackEvent, AnalyticsEvents } from '../utils/analytics';

// Country prefixes from the design (Kenya default, then South Sudan,
// Uganda, US/Canada, Australia). The design cycles on tap.
const PREFIXES = ['+254', '+211', '+256', '+1', '+61'];

// In-app keypad rows (design: 1–9, blank, 0, backspace).
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

const OTP_LENGTH = 6;
const MAX_OTP_ATTEMPTS = 5;

const formatAuthError = (error) => {
  const msg = error?.message || String(error || '');
  if (/Supabase config missing/i.test(msg)) return msg;
  if (/Supabase URL must use https/i.test(msg)) return msg;
  if (/Network request failed/i.test(msg)) {
    return 'Network request failed. Check your internet connection and confirm your Supabase URL/key are set correctly.';
  }
  return msg || 'Please try again.';
};

const SignupScreen = ({ navigation }) => {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [prefixIdx, setPrefixIdx] = useState(0);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [inputError, setInputError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Surface a friendly error before/while Supabase's server-side
  // rate-limit kicks in — without this, a user typing wrong codes sees
  // nothing happen and assumes the app is broken. Reset on success or
  // Resend. Network drops never count (see handleVerify).
  const [failedAttempts, setFailedAttempts] = useState(0);
  const attemptsExhausted = failedAttempts >= MAX_OTP_ATTEMPTS;

  // Apple App Review (and most international privacy regimes) require
  // an explicit acceptance click for ToS / Privacy — a passive "by
  // continuing" line is not sufficient. Not in the design mock, but
  // it gates SEND CODE deliberately.
  const [eulaAccepted, setEulaAccepted] = useState(false);

  const insets = useSafeAreaInsets();
  const { startOtp, loginWithOtp } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    trackEvent(AnalyticsEvents.SIGNUP_START);
  }, []);

  // ── Resend cooldown — gate Resend for 30s per tap so users can't
  //    hammer the OTP service. Interval cleared on unmount. ──
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownTimerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, []);
  const startResendCooldown = () => {
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    setCooldownSeconds(30);
    cooldownTimerRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const prefix = PREFIXES[prefixIdx];
  // E.164: prefix + national number, leading zeros stripped
  // ("+254" + "0912 345 678" → "+254912345678").
  const e164 = prefix + phone.replace(/\D/g, '').replace(/^0+/, '');
  const displayNumber = `${prefix} ${phone.trim() || ''}`.trim();

  const finishLogin = useCallback((result) => {
    trackEvent(AnalyticsEvents.SIGNUP_COMPLETE, { method: 'phone' });
    // Returning user with any profile data → AppNavigator flips to Main
    const appUser = result?.appUser;
    const appProfile = appUser?.profile;
    if (
      appProfile?.profileComplete ||
      appProfile?.accountPurpose ||
      appProfile?.displayName ||
      appUser?.displayName
    ) {
      return;
    }
    // Brand-new user → profile setup
    navigation.replace('ProfileSetup');
  }, [navigation]);

  const handlePhoneChange = (text) => {
    if (inputError) setInputError('');
    setPhone(text);
  };

  const handleSendCode = async () => {
    const devBypass = devAuthBypassEnabled();
    if (!devBypass) {
      const error = validatePhoneDigits(phone);
      if (error) {
        setInputError(error);
        return;
      }
    }
    setInputError('');
    try {
      Keyboard.dismiss();
      setSending(true);
      const authPhone = phone.replace(/\D/g, '').length ? e164 : `${prefix}000000000`;
      await startOtp({ phone: authPhone });
      setOtp('');
      setFailedAttempts(0);
      if (devBypass) {
        const result = await loginWithOtp({ phone: authPhone, code: '000000' });
        finishLogin(result);
        return;
      }
      setStep('otp');
    } catch (err) {
      Alert.alert('Could not send code', formatAuthError(err));
    } finally {
      setSending(false);
    }
  };

  const handleVerify = useCallback(async (code) => {
    if (verifying) return;
    setVerifying(true);
    try {
      const result = await loginWithOtp({ phone: e164, code });
      setFailedAttempts(0); // success — clear the retry guard
      finishLogin(result);
    } catch (error) {
      // A network drop is NOT a wrong code — counting it toward the
      // attempt lockout froze the flow for users on flaky connections
      // who had typed the RIGHT code all along.
      const isNetwork = /network|fetch|timeout|abort/i.test(error?.message || '');
      if (isNetwork) {
        Alert.alert(
          'Connection problem',
          "We couldn't reach the server to check your code. Check your connection and try again — this doesn't count against your attempts.",
        );
        setOtp('');
        return;
      }
      const next = failedAttempts + 1;
      setFailedAttempts(next);
      setOtp(''); // auto-verify fires at 6 digits, so clear for a retype
      if (next >= MAX_OTP_ATTEMPTS) {
        Alert.alert(
          'Too many incorrect codes',
          "We're holding off verification for a few minutes. Tap 'Resend' to get a fresh one.",
        );
      } else {
        const remaining = MAX_OTP_ATTEMPTS - next;
        Alert.alert(
          'Invalid code',
          `That code didn't match. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
        );
      }
    } finally {
      setVerifying(false);
    }
  }, [verifying, loginWithOtp, e164, failedAttempts, finishLogin]);

  // Keypad entry — append/delete on the otp string; auto-verify the
  // moment the sixth digit lands (design's otpTap behavior).
  const handleKey = (key) => {
    if (verifying) return;
    if (key === '⌫') {
      setOtp((prev) => prev.slice(0, -1));
      return;
    }
    if (!key || attemptsExhausted) return;
    if (otp.length >= OTP_LENGTH) return;
    const next = otp + key;
    setOtp(next);
    if (next.length === OTP_LENGTH) handleVerify(next);
  };

  const handleResend = () => {
    if (cooldownSeconds > 0) return;
    startResendCooldown();
    (async () => {
      try {
        await startOtp({ phone: e164 });
        setFailedAttempts(0); // fresh code → re-enable verification
        setOtp('');
        Alert.alert('Code Sent', 'A new verification code has been sent.');
      } catch (error) {
        Alert.alert('Could not resend', formatAuthError(error));
      }
    })();
  };

  const backToPhone = () => {
    setStep('phone');
    setOtp('');
    setFailedAttempts(0);
  };

  // ─── OTP screen ───
  if (step === 'otp') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 14 }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <TouchableOpacity
          style={styles.backBtn}
          onPress={backToPhone}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </TouchableOpacity>

        <Text style={styles.h1} accessibilityRole="header">Enter the code</Text>
        {devAuthBypassEnabled() ? (
          <Text style={styles.devHint}>
            DEV BYPASS — no SMS sent, any 6 digits sign you in.
          </Text>
        ) : null}
        <Text style={styles.sub}>
          Sent to {displayNumber} ·{' '}
          <Text
            style={styles.link}
            onPress={backToPhone}
            accessibilityRole="link"
            accessibilityLabel="Edit phone number"
          >
            edit
          </Text>
        </Text>

        {/* Six code boxes — active box border = accent */}
        <View style={styles.otpRow} accessibilityLabel={`Verification code, ${otp.length} of ${OTP_LENGTH} digits entered`}>
          {Array.from({ length: OTP_LENGTH }, (_, i) => (
            <View
              key={i}
              style={[
                styles.otpBox,
                { borderColor: i === otp.length ? colors.accent : colors.separator },
              ]}
            >
              <Text style={styles.otpDigit}>{otp[i] || ''}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.resendLine}>
          Didn't get it?{' '}
          {cooldownSeconds > 0 ? (
            <Text style={styles.resendDisabled}>Resend in {cooldownSeconds}s</Text>
          ) : (
            <Text
              style={styles.link}
              onPress={handleResend}
              accessibilityRole="link"
              accessibilityLabel="Resend code"
            >
              Resend
            </Text>
          )}
        </Text>

        {attemptsExhausted ? (
          <Text style={styles.lockedHint}>
            Too many incorrect codes. Tap "Resend" for a fresh one.
          </Text>
        ) : null}

        <View style={{ flex: 1 }} />

        {/* In-app keypad — 3×4: 1–9, blank, 0, ⌫ */}
        <View style={styles.keypad}>
          {KEYPAD.map((key, i) => (
            <TouchableOpacity
              key={i}
              testID={key ? `keypad-${key === '⌫' ? 'delete' : key}` : 'keypad-blank'}
              style={[
                styles.key,
                (key === '' || key === '⌫') && styles.keyGhost,
              ]}
              onPress={() => handleKey(key)}
              disabled={key === '' || verifying}
              activeOpacity={0.6}
              accessibilityRole={key === '' ? 'none' : 'button'}
              accessibilityLabel={key === '⌫' ? 'Delete' : key || undefined}
              accessibilityElementsHidden={key === ''}
            >
              <Text style={styles.keyLabel}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  // ─── Phone screen ───
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {navigation?.canGoBack?.() ? (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backBtn} />
      )}

      <Text style={styles.h1} accessibilityRole="header">What's your number?</Text>
      <Text style={styles.sub}>We'll text you a code. That's the whole sign-in.</Text>

      <View style={styles.phoneRow}>
        <TouchableOpacity
          style={styles.prefixBtn}
          onPress={() => setPrefixIdx((prefixIdx + 1) % PREFIXES.length)}
          accessibilityRole="button"
          accessibilityLabel={`Country code ${prefix}. Tap to change`}
        >
          <Text style={styles.prefixText}>{prefix}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.phoneInput}
          value={phone}
          onChangeText={handlePhoneChange}
          placeholder="912 345 678"
          placeholderTextColor={colors.gray400}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          accessibilityLabel="Phone number"
        />
      </View>

      <Text style={styles.helper}>Your number is never shown on your profile.</Text>

      {inputError ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={15} color={colors.error} />
          <Text style={styles.errorText}>{inputError}</Text>
        </View>
      ) : null}

      <View style={{ flex: 1 }} />

      {/* Explicit ToS/Privacy acceptance — required for App Review even
          though the design mock omits it. Gates SEND CODE. */}
      <TouchableOpacity
        style={styles.eulaRow}
        onPress={() => setEulaAccepted((v) => !v)}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: eulaAccepted }}
        accessibilityLabel="I am 18 or older and agree to the Terms and Privacy Policy"
      >
        <View style={[styles.eulaBox, eulaAccepted && styles.eulaBoxChecked]}>
          {eulaAccepted ? (
            <Ionicons name="checkmark" size={13} color={colors.onGold} />
          ) : null}
        </View>
        <Text style={styles.eulaText}>
          I'm 18 or older and accept JuNubin's{' '}
          <Text
            style={styles.link}
            onPress={() => navigation.navigate('SettingsInfo', { pageKey: 'terms' })}
          >
            Terms
          </Text>
          {' '}&{' '}
          <Text
            style={styles.link}
            onPress={() => navigation.navigate('SettingsInfo', { pageKey: 'privacy' })}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </TouchableOpacity>

      <Blueprint style={styles.ctaFrame}>
        <TouchableOpacity
          style={[styles.cta, (sending || (!devAuthBypassEnabled() && !eulaAccepted)) && styles.ctaDisabled]}
          onPress={handleSendCode}
          disabled={sending || (!devAuthBypassEnabled() && !eulaAccepted)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Send code"
          accessibilityState={{ disabled: sending || (!devAuthBypassEnabled() && !eulaAccepted) }}
        >
          <Text style={styles.ctaText}>SEND CODE</Text>
        </TouchableOpacity>
      </Blueprint>
    </KeyboardAvoidingView>
  );
};

// ═══════════════════════════════════════════════════════════
const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: 22,
  },

  backBtn: {
    width: 44,
    height: 44,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  h1: {
    marginTop: 18,
    marginBottom: 6,
    fontSize: 36,
    lineHeight: 38,
    fontFamily: FontFamily.heading,
    color: colors.black,
  },
  sub: {
    marginBottom: 26,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
  },
  link: {
    fontFamily: FontFamily.semibold,
    color: colors.accentDark,
  },

  // ─── Phone step ───
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
  },
  prefixBtn: {
    height: 56,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: 17,
    fontFamily: FontFamily.regular,
    color: colors.black,
  },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    height: 56,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    paddingHorizontal: 16,
    fontSize: 19,
    letterSpacing: 0.76,
    fontFamily: FontFamily.regular,
    color: colors.black,
  },
  helper: {
    marginTop: 12,
    fontSize: 12.5,
    lineHeight: 19,
    fontFamily: FontFamily.regular,
    color: colors.gray400,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    color: colors.error,
  },

  // EULA acceptance row
  eulaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    marginBottom: 10,
  },
  eulaBox: {
    width: 18,
    height: 18,
    marginTop: 2,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eulaBoxChecked: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  eulaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
  },

  // Gold CTA in a Blueprint frame (design: 54px, condensed caps)
  ctaFrame: {
    marginBottom: 44,
  },
  cta: {
    height: 54,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    fontSize: 18,
    letterSpacing: 1.44,
    fontFamily: FontFamily.headingBold,
    color: colors.onGold,
  },

  // ─── OTP step ───
  // Dev-only banner (never renders in a build — see config/devAuth).
  devHint: {
    marginTop: 6,
    fontSize: 12,
    letterSpacing: 0.6,
    fontFamily: FontFamily.headingBold,
    color: colors.gold,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 60,
    borderWidth: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigit: {
    fontSize: 26,
    fontFamily: FontFamily.heading,
    color: colors.black,
  },
  resendLine: {
    marginTop: 14,
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: colors.gray400,
  },
  resendDisabled: {
    fontFamily: FontFamily.medium,
    color: colors.gray400,
  },
  lockedHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FontFamily.medium,
    color: colors.gray500,
  },

  // In-app keypad
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 6,
  },
  key: {
    // 3 columns with two 6px gutters between them.
    flexBasis: '32%',
    flexGrow: 1,
    height: 52,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyGhost: {
    backgroundColor: 'transparent',
  },
  keyLabel: {
    fontSize: 22,
    fontFamily: FontFamily.headingMedium,
    color: colors.black,
  },
});

export default SignupScreen;
