import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import LogoMark from '../components/LogoMark';
import { useAuth } from '../auth';
import { useAccessibilityPreferences } from '../accessibility';
import { validateEmail, validatePhoneDigits } from '../utils/validators';
import { trackEvent, AnalyticsEvents } from '../utils/analytics';


const { width: W, height: H } = Dimensions.get('window');
const LANDING_IMAGE = require('../assets/landing.jpeg');

// ── Warm earth-tone palette for the auth flow ──
// Login feels welcoming/grounded — honey gold, burnt orange, warm brown ochre,
// instead of the flag-red used elsewhere in the app.
const WARM = {
  highlight: '#FFD56B',   // bright honey for italic accent words
  primary:   '#F5B741',   // honey gold
  mid:       '#E27D2C',   // burnt orange
  deep:      '#8E5524',   // warm brown ochre
  link:      '#FFC76B',   // warm gold for links / resend
};

const SignupScreen = ({ navigation, route }) => {
  // Email-only auth for the v1 launch. Phone OTP is removed for now —
  // when we re-enable it, restore the `selectedMethod` state, phone field,
  // country picker, and pass `phone` into startOtp/loginWithOtp.
  const [step, setStep] = useState('input'); // 'input' | 'verify'
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [emailActive, setEmailActive] = useState(false);
  const insets = useSafeAreaInsets();
  const { startOtp, loginWithOtp, setDevBypass } = useAuth();
  const { prefs } = useAccessibilityPreferences();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  // Cinematic entrance — slow background zoom + content fade-in (matches Onboarding)
  const bgZoom = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    trackEvent(AnalyticsEvents.SIGNUP_START);
    Animated.timing(bgZoom, { toValue: 1.06, duration: 6000, useNativeDriver: true }).start();
    Animated.spring(entrance, { toValue: 1, tension: 35, friction: 10, useNativeDriver: true }).start();
  }, [bgZoom, entrance]);

  const contentOpacity = entrance.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.3, 1] });
  const contentTranslate = entrance.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  // Refs for verification code inputs
  const codeRefs = useRef([]);

  const handleEmailChange = (text) => {
    if (inputError) setInputError('');
    setEmail(text);
  };

  const [inputError, setInputError] = useState('');
  // Apple App Review (and most international privacy regimes) require
  // an explicit acceptance click for ToS / Privacy on a dating app —
  // a passive "by continuing" line is no longer sufficient. We persist
  // the click as `Profile.eulaAcceptedAt` once the User row exists; for
  // now (pre-account) we just gate the Continue button.
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const formatAuthError = (error) => {
    const msg = error?.message || String(error || '');
    if (/Supabase config missing/i.test(msg)) return msg;
    if (/Supabase URL must use https/i.test(msg)) return msg;
    if (/Network request failed/i.test(msg)) {
      return 'Network request failed. Check your internet connection and confirm your Supabase URL/key are set correctly.';
    }
    return msg || 'Please try again.';
  };

  const validateInput = () => validateEmail(email);

  const handleSendCode = async () => {
    const error = validateInput();
    if (error) {
      setInputError(error);
      return;
    }
    setInputError('');
    try {
      Keyboard.dismiss();
      await startOtp({ email: email.trim().toLowerCase() });
      setStep('verify');
    } catch (error) {
      Alert.alert('Could not send code', formatAuthError(error));
    }
  };

  const handleCodeChange = (text, index) => {
    const newCode = [...verificationCode];
    newCode[index] = text;
    setVerificationCode(newCode);

    // Auto-advance to next input
    if (text && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = verificationCode.join('');
    if (code.length === 6) {
      try {
        const result = await loginWithOtp({
          email: email.trim().toLowerCase(),
          code,
        });
        trackEvent(AnalyticsEvents.SIGNUP_COMPLETE, { method: 'email' });
        // Returning user with any profile data → go straight to Main
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
      } catch (error) {
        Alert.alert('Verification failed', formatAuthError(error));
      }
    }
  };

  const handleResend = () => {
    (async () => {
      try {
        await startOtp({
          email: email.trim().toLowerCase(),
        });
        Alert.alert('Code Sent', 'A new verification code has been sent.');
        setVerificationCode(['', '', '', '', '', '']);
        codeRefs.current[0]?.focus();
      } catch (error) {
        Alert.alert('Could not resend', formatAuthError(error));
      }
    })();
  };

  const isCodeComplete = verificationCode.join('').length === 6;

  const maskedContact = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  // ─── Verification Code Screen ───
  if (step === 'verify') {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <Animated.View style={[styles.bgWrap, { transform: [{ scale: bgZoom }] }]}>
          <Image source={LANDING_IMAGE} style={styles.bgImage} resizeMode="cover" />
        </Animated.View>
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.45)',
            'rgba(0,0,0,0.20)',
            'rgba(0,0,0,0.65)',
            'rgba(0,0,0,0.95)',
            'rgba(0,0,0,0.99)',
          ]}
          locations={[0, 0.30, 0.55, 0.82, 1]}
          style={StyleSheet.absoluteFill}
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
              {/* Top bar — same as input step */}
              <View style={styles.topBar}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => { setStep('input'); setVerificationCode(['', '', '', '', '', '']); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <LogoMark size={28} light />
                <View style={{ width: 36 }} />
              </View>

              {/* Anchored content */}
              <View style={styles.contentWrap}>
                <View style={styles.heroAccentLine} />
                <Text style={styles.eyebrow}>VERIFY</Text>
                <Text style={styles.heading}>
                  Enter your{'\n'}
                  <Text style={styles.headingAccent}>code.</Text>
                </Text>
                <Text style={styles.subheading}>
                  We sent a 6-digit code to{' '}
                  <Text style={styles.verifyContactInline}>{maskedContact}</Text>
                </Text>

                <View style={styles.codeRow}>
                  {verificationCode.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => { codeRefs.current[index] = ref; }}
                      style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
                      value={digit}
                      onChangeText={(text) => handleCodeChange(text.slice(-1), index)}
                      onKeyPress={(e) => handleCodeKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={1}
                      textAlign="center"
                      autoFocus={index === 0}
                      placeholderTextColor="rgba(255,255,255,0.3)"
                    />
                  ))}
                </View>

                <TouchableOpacity onPress={handleResend} style={styles.resendBtn}>
                  <Text style={styles.resendText}>Didn't receive a code? </Text>
                  <Text style={styles.resendLink}>Resend</Text>
                </TouchableOpacity>
              </View>

              {/* Verify CTA — same gradient pill */}
              <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
                <TouchableOpacity
                  style={[styles.ctaWrap, !isCodeComplete && styles.ctaWrapDisabled]}
                  onPress={handleVerify}
                  disabled={!isCodeComplete}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={[WARM.primary, WARM.mid, WARM.deep]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ctaGradient}
                  >
                    <Text style={styles.ctaText}>Verify</Text>
                    <View style={styles.ctaArrow}>
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ─── Input Screen (Email only) ───
  const hasInput = email.trim().length > 0;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Background landing image — matches OnboardingScreen */}
      <Animated.View style={[styles.bgWrap, { transform: [{ scale: bgZoom }] }]}>
        <Image source={LANDING_IMAGE} style={styles.bgImage} resizeMode="cover" />
      </Animated.View>

      {/* Gradient overlay — same 5-stop fade as Onboarding */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.30)',
          'rgba(0,0,0,0.10)',
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0.92)',
          'rgba(0,0,0,0.98)',
        ]}
        locations={[0, 0.28, 0.55, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
            {/* Top bar — back chevron + Skip pill, matches Onboarding */}
            <View style={styles.topBar}>
              {navigation.canGoBack() ? (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              ) : <View style={{ width: 36 }} />}

              <LogoMark size={28} light />

              {/* Skip is a dev-only bypass — hide it in production builds.
                  Same flag the AuthContext uses to enable dev login. */}
              {process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH === 'true' ? (
                <TouchableOpacity
                  onPress={() => setDevBypass(true)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
              ) : <View style={{ width: 36 }} />}
            </View>

            {/* Anchored content — sits low like the Onboarding pages */}
            <Animated.View
              style={[
                styles.contentWrap,
                { opacity: contentOpacity, transform: [{ translateY: contentTranslate }] },
              ]}
            >
              <View style={styles.heroAccentLine} />
              <Text style={styles.eyebrow}>JOIN THE COMMUNITY</Text>
              <Text style={styles.subheading}>
                Sign up with your email —{'\n'}we'll send you a verification code.
              </Text>

              {/* Email field — sole entry point for v1; phone OTP comes back later. */}
              <View style={[styles.fieldCard, styles.fieldCardActive]}>
                <Text style={[styles.fieldTitle, styles.fieldTitleActive]}>Email address</Text>
                <View style={styles.inputGroup}>
                  <TextInput
                    style={[styles.input, styles.inputFull, emailActive && styles.inputActive]}
                    placeholder="you@example.com"
                    placeholderTextColor="rgba(255, 255, 255, 0.35)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={handleEmailChange}
                    onFocus={() => setEmailActive(true)}
                    onBlur={() => setEmailActive(false)}
                    autoFocus
                  />
                </View>
              </View>

              {inputError ? (
                <View style={styles.inputErrorRow}>
                  <Ionicons name="alert-circle" size={15} color="#F05252" />
                  <Text style={styles.inputErrorText}>{inputError}</Text>
                </View>
              ) : null}
            </Animated.View>

            {/* Bottom CTA — gradient pill matching Onboarding */}
            <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
              {step === 'input' && (
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
                      <Ionicons name="checkmark" size={14} color="#000" />
                    ) : null}
                  </View>
                  <Text style={styles.eulaText}>
                    I'm 18 or older and accept JuNubin's{' '}
                    <Text style={styles.termsLink} onPress={() => navigation.navigate('SettingsInfo', { pageKey: 'terms' })}>
                      Terms
                    </Text>
                    {' '}&{' '}
                    <Text style={styles.termsLink} onPress={() => navigation.navigate('SettingsInfo', { pageKey: 'privacy' })}>
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.ctaWrap, (!hasInput || (step === 'input' && !eulaAccepted)) && styles.ctaWrapDisabled]}
                onPress={handleSendCode}
                disabled={!hasInput || !!inputError || (step === 'input' && !eulaAccepted)}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[WARM.primary, WARM.mid, WARM.deep]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ctaGradient}
                >
                  <Text style={styles.ctaText}>Continue</Text>
                  <View style={styles.ctaArrow}>
                    <Ionicons name="arrow-forward" size={18} color="#FFF" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.termsText}>
                Screenshots are blocked everywhere in JuNubin.
              </Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
};

const getStyles = (colors, isDark) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  bgWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgImage: {
    width: W * 1.2,
    height: H * 1.05,
    marginLeft: -(W * 0.1),
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  containerVerify: {
    backgroundColor: colors.white,
  },
  // Top bar — back / logo / skip
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.3,
  },
  backButtonVerify: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: 24,
    marginTop: 4,
  },
  // Anchored content — heading + form sit toward the bottom of the screen,
  // matching the cinematic anchor of OnboardingScreen.
  contentWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  heroAccentLine: {
    width: 38,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: WARM.primary,
    marginBottom: 16,
    opacity: 0.95,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: WARM.primary,
    letterSpacing: 3.5,
    marginBottom: 14,
  },
  // With the big "Get Started." heading gone, the subheading carries the
  // page's intro tone — slightly bigger and brighter than a typical
  // subhead so the field cards below still feel anchored to a heading.
  subheading: {
    fontSize: 17,
    fontFamily: FontFamily.medium,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 26,
    lineHeight: 24,
  },
  // Field cards — frosted glass on dark
  fieldCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fieldCardActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  fieldTitle: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.45)',
    letterSpacing: 0.3,
  },
  fieldTitleActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  // Or divider
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  orText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.35)',
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
    marginLeft: 2,
  },
  // Bottom anchored CTA + terms — matches OnboardingScreen's "Get Started" button
  bottom: {
    paddingTop: 10,
  },
  ctaWrap: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: WARM.deep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 14,
  },
  ctaWrapDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 17,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFF',
    letterSpacing: 0.3,
  },
  ctaArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Method toggle
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 3,
    marginBottom: 16,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  methodTabActive: {
    backgroundColor: '#FFFFFF',
  },
  methodTabText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  methodTabTextActive: {
    color: '#1A1A1A',
  },

  // Input
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  countryCodeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  countryCodeText: {
    ...Typography.bodySemibold,
    color: '#FFFFFF',
  },
  phoneCodeBox: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  phoneCodeText: {
    ...Typography.bodySemibold,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  switchMethod: {
    marginTop: 18,
    alignSelf: 'center',
  },
  switchMethodText: {
    fontSize: 14,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: '#FCCD12',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    ...Typography.body,
    color: '#FFFFFF',
  },
  inputFull: {
    flex: 1,
  },
  inputActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },

  // Inline error
  inputErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  inputErrorText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: '#F05252',
    flex: 1,
  },

  // EULA acceptance row
  eulaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 10,
  },
  eulaBox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
    marginTop: 2,
  },
  eulaBoxChecked: {
    backgroundColor: '#FCCD12',
    borderColor: '#FCCD12',
  },
  eulaText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 18,
  },

  // Terms
  termsText: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    lineHeight: 17,
  },
  termsLink: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },


  // ─── Verification Screen — frosted glass on cinematic dark ───
  verifyContactInline: {
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 22,
  },
  codeInput: {
    width: 44,
    height: 54,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    fontSize: 22,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  codeInputFilled: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  resendBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.55)',
  },
  resendLink: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: WARM.link,
  },

  // Country picker — tall bottom sheet
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    minHeight: '75%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  pickerRowActive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  pickerFlag: {
    fontSize: 22,
  },
  pickerName: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.medium,
    color: '#FFFFFF',
  },
  pickerCode: {
    fontSize: 14,
    fontFamily: FontFamily.semibold,
    color: 'rgba(255,255,255,0.5)',
  },
});

export default SignupScreen;
