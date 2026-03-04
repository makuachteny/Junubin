import React, { useState, useRef, useMemo } from 'react';
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
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../auth';

const { width } = Dimensions.get('window');

const LANDING_IMAGE = require('../assets/landing.jpeg');

const SignupScreen = ({ navigation }) => {
  // Flow: input → verify
  const [step, setStep] = useState('input'); // 'input' | 'verify'
  const [selectedMethod, setSelectedMethod] = useState('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [phoneActive, setPhoneActive] = useState(false);
  const [emailActive, setEmailActive] = useState(false);
  const insets = useSafeAreaInsets();
  const { startOtp, loginWithOtp } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  // Refs for verification code inputs
  const codeRefs = useRef([]);

  const handlePhoneChange = (text) => {
    const digits = text.replace(/\D/g, '');
    let formatted = '';
    if (digits.length <= 3) {
      formatted = digits;
    } else if (digits.length <= 6) {
      formatted = '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
    } else {
      formatted = '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6, 10);
    }
    setPhone(formatted);
  };

  const handleSendCode = async () => {
    const phoneDigits = phone.replace(/\D/g, '');
    if (
      (selectedMethod === 'phone' && phoneDigits.length >= 10) ||
      (selectedMethod === 'email' && email.includes('@'))
    ) {
      try {
        Keyboard.dismiss();
        await startOtp({
          email: selectedMethod === 'email' ? email.trim().toLowerCase() : undefined,
          phone: selectedMethod === 'phone' ? `+1${phoneDigits}` : undefined,
        });
        setStep('verify');
      } catch (error) {
        Alert.alert('Could not send code', error.message || 'Please try again.');
      }
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
          email: selectedMethod === 'email' ? email.trim().toLowerCase() : undefined,
          phone: selectedMethod === 'phone' ? `+1${phone.replace(/\D/g, '')}` : undefined,
          code,
        });
        // Returning user with complete profile → go straight to Main
        const isProfileComplete = result?.appUser?.profile?.profileComplete;
        navigation.replace(isProfileComplete ? 'Main' : 'ProfileSetup');
      } catch (error) {
        Alert.alert('Verification failed', error.message || 'Invalid code.');
      }
    }
  };

  const handleResend = () => {
    (async () => {
      try {
        await startOtp({
          email: selectedMethod === 'email' ? email.trim().toLowerCase() : undefined,
          phone: selectedMethod === 'phone' ? `+1${phone.replace(/\D/g, '')}` : undefined,
        });
        Alert.alert('Code Sent', 'A new verification code has been sent.');
        setVerificationCode(['', '', '', '', '', '']);
        codeRefs.current[0]?.focus();
      } catch (error) {
        Alert.alert('Could not resend', error.message || 'Please try again.');
      }
    })();
  };

  const phoneDigits = phone.replace(/\D/g, '');
  const isInputValid =
    (selectedMethod === 'phone' && phoneDigits.length >= 10) ||
    (selectedMethod === 'email' && email.includes('@'));
  const isCodeComplete = verificationCode.join('').length === 6;

  const maskedContact = selectedMethod === 'phone'
    ? phone
    : email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  // ─── Verification Code Screen ───
  if (step === 'verify') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.white }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[styles.container, styles.containerVerify, { paddingTop: insets.top }]}>
            {/* Back */}
            <TouchableOpacity
              style={styles.backButtonVerify}
              onPress={() => { setStep('input'); setVerificationCode(['', '', '', '', '', '']); }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.black} />
            </TouchableOpacity>

            {/* Icon */}
            <View style={styles.verifyIconWrap}>
              <View style={styles.verifyIcon}>
                <Ionicons
                  name={selectedMethod === 'phone' ? 'phone-portrait' : 'mail'}
                  size={32}
                  color={colors.accent}
                />
              </View>
            </View>

            {/* Heading */}
            <Text style={styles.verifyTitle}>Enter verification code</Text>
            <Text style={styles.verifySubtitle}>
              We sent a verification code to{'\n'}
              <Text style={styles.verifyContact}>{maskedContact}</Text>
            </Text>

            {/* Code Input */}
            <View style={styles.codeRow}>
              {verificationCode.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { codeRefs.current[index] = ref; }}
                  style={[
                    styles.codeInput,
                    digit ? styles.codeInputFilled : null,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleCodeChange(text.slice(-1), index)}
                  onKeyPress={(e) => handleCodeKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  autoFocus={index === 0}
                />
              ))}
            </View>

            {/* Resend */}
            <TouchableOpacity onPress={handleResend} style={styles.resendBtn}>
              <Text style={styles.resendText}>Didn't receive a code? </Text>
              <Text style={styles.resendLink}>Resend</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            {/* Verify Button */}
            <View style={[styles.verifyButtonWrap, { paddingBottom: insets.bottom + 20 }]}>
              <TouchableOpacity
                style={[styles.nextCircleBtn, !isCodeComplete && styles.nextCircleBtnDisabled]}
                onPress={handleVerify}
                disabled={!isCodeComplete}
              >
                <Ionicons name="arrow-forward" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  }

  // ─── Input Screen (Phone/Email) — with landing.JPG background ───
  return (
    <ImageBackground
      source={LANDING_IMAGE}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Logo */}
            <View style={styles.logoContainer}>
              <BrandLogo size="medium" light />
            </View>

            {/* Heading */}
            <Text style={styles.heading}>Create your{'\n'}account</Text>
            <Text style={styles.subheading}>
              Join AnaJubin and start connecting with the South Sudanese community.
            </Text>

            {/* Method Toggle */}
            <View style={styles.methodToggle}>
              <TouchableOpacity
                style={[styles.methodTab, selectedMethod === 'phone' && styles.methodTabActive]}
                onPress={() => setSelectedMethod('phone')}
              >
                <Ionicons
                  name="phone-portrait"
                  size={16}
                  color={selectedMethod === 'phone' ? '#FFFFFF' : 'rgba(255,255,255,0.5)'}
                />
                <Text style={[styles.methodTabText, selectedMethod === 'phone' && styles.methodTabTextActive]}>
                  Phone
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.methodTab, selectedMethod === 'email' && styles.methodTabActive]}
                onPress={() => setSelectedMethod('email')}
              >
                <Ionicons
                  name="mail"
                  size={16}
                  color={selectedMethod === 'email' ? '#FFFFFF' : 'rgba(255,255,255,0.5)'}
                />
                <Text style={[styles.methodTabText, selectedMethod === 'email' && styles.methodTabTextActive]}>
                  Email
                </Text>
              </TouchableOpacity>
            </View>

            {/* Phone Input */}
            {selectedMethod === 'phone' && (
              <View style={styles.inputGroup}>
                <View style={[styles.countryCode, phoneActive && styles.countryCodeActive]}>
                  <Text style={styles.countryCodeText}>+1</Text>
                </View>
                <TextInput
                  style={[styles.input, phoneActive && styles.inputActive]}
                  placeholder="(555) 123-4567"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={handlePhoneChange}
                  onFocus={() => setPhoneActive(true)}
                  onBlur={() => setPhoneActive(false)}
                  maxLength={14}
                />
              </View>
            )}

            {/* Email Input */}
            {selectedMethod === 'email' && (
              <View style={styles.inputGroup}>
                <TextInput
                  style={[styles.input, styles.inputFull, emailActive && styles.inputActive]}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailActive(true)}
                  onBlur={() => setEmailActive(false)}
                />
              </View>
            )}

            {/* Terms */}
            <View style={{ flex: 1 }} />
            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>

            {/* Next Button (BLK-style circle) */}
            <View style={[styles.nextRow, { paddingBottom: insets.bottom + 20 }]}>
              <TouchableOpacity
                style={[styles.nextCircleBtn, !isInputValid && styles.nextCircleBtnDisabled]}
                onPress={handleSendCode}
                disabled={!isInputValid}
              >
                <Ionicons name="arrow-forward" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
};

const getStyles = (colors, isDark) => StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 22, 18, 0.45)',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  containerVerify: {
    backgroundColor: colors.white,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: 24,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heading: {
    fontSize: 34,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 40,
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subheading: {
    ...Typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 36,
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Method toggle
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: colors.accent,
  },
  methodTabText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  methodTabTextActive: {
    color: '#FFFFFF',
  },

  // Input
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countryCode: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  countryCodeActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint10,
  },
  countryCodeText: {
    ...Typography.bodySemibold,
    color: colors.accent,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    ...Typography.body,
    color: '#FFFFFF',
  },
  inputFull: {
    flex: 1,
  },
  inputActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint08,
  },

  // Terms
  termsText: {
    ...Typography.caption,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  termsLink: {
    color: colors.accent,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },

  // Next button (BLK circle style)
  nextRow: {
    alignItems: 'flex-end',
  },
  nextCircleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  nextCircleBtnDisabled: {
    opacity: 0.3,
  },

  // ─── Verification Screen ───
  verifyIconWrap: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  verifyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentTint08,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accentTint15,
  },
  verifyTitle: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  verifySubtitle: {
    ...Typography.bodySmall,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  verifyContact: {
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
  },
  codeInput: {
    width: 46,
    height: 58,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
    textAlign: 'center',
  },
  codeInputFilled: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint04,
  },
  resendBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    ...Typography.bodySmall,
    color: colors.gray500,
  },
  resendLink: {
    ...Typography.bodySmallMedium,
    color: colors.accent,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  verifyButtonWrap: {
    alignItems: 'flex-end',
  },
});

export default SignupScreen;
