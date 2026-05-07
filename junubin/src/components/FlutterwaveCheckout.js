/**
 * FlutterwaveCheckout
 *
 * Full-screen modal that renders the Flutterwave hosted checkout
 * in a WebView. Detects success/failure redirects and returns control
 * to the app.
 *
 * Props:
 *   visible - boolean
 *   paymentLink - URL from FlutterwaveService.createPayment()
 *   txRef - transaction reference for status polling
 *   onSuccess(txRef) - called when payment succeeds
 *   onCancel() - called when user cancels or closes
 *   onError(message) - called on payment failure
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import FlutterwaveService from '../payments/FlutterwaveService';

/** Max time to poll for payment confirmation (ms) */
const POLL_TIMEOUT = 120000; // 2 minutes
const POLL_INTERVAL = 3000; // 3 seconds

export default function FlutterwaveCheckout({
  visible,
  paymentLink,
  txRef,
  onSuccess,
  onCancel,
  onError,
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const webViewRef = useRef(null);

  /**
   * Poll the payment status endpoint until success, failure, or timeout.
   */
  const pollPaymentStatus = useCallback(async () => {
    if (!txRef) return;
    setVerifying(true);

    const startTime = Date.now();
    const poll = async () => {
      try {
        const result = await FlutterwaveService.checkPaymentStatus(txRef);
        if (result.status === 'successful') {
          setVerifying(false);
          onSuccess?.(txRef);
          return;
        }
        if (result.status === 'failed' || result.status === 'cancelled') {
          setVerifying(false);
          onError?.(`Payment ${result.status}`);
          return;
        }
        // Still pending — poll again if within timeout
        if (Date.now() - startTime < POLL_TIMEOUT) {
          setTimeout(poll, POLL_INTERVAL);
        } else {
          setVerifying(false);
          // Payment may still be processing — tell user to check later
          onSuccess?.(txRef); // Optimistic: webhook will grant entitlement
        }
      } catch {
        setVerifying(false);
        onError?.('Could not verify payment. Please check your transaction history.');
      }
    };

    poll();
  }, [txRef, onSuccess, onError]);

  /**
   * Intercept navigation to detect Flutterwave redirect URLs.
   * Flutterwave redirects to the configured redirect_url on completion.
   */
  const handleNavigationChange = useCallback((navState) => {
    const url = navState.url || '';

    // Detect success redirect (configured as junubin://payment/callback or a custom URL)
    if (
      url.includes('junubin://payment') ||
      url.includes('/payment/callback') ||
      url.includes('status=successful') ||
      url.includes('status=completed')
    ) {
      pollPaymentStatus();
      return false;
    }

    // Detect cancel
    if (url.includes('status=cancelled') || url.includes('cancel')) {
      onCancel?.();
      return false;
    }

    return true;
  }, [pollPaymentStatus, onCancel]);

  const handleClose = () => {
    if (verifying) return; // Don't allow close while verifying
    onCancel?.();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.container, { backgroundColor: colors.cardBg }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} disabled={verifying}>
            <Ionicons name="close" size={24} color={verifying ? colors.gray400 : colors.black} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name="shield-checkmark" size={16} color="#009739" />
            <Text style={[styles.headerTitle, { color: colors.black }]}>Secure Payment</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Verifying overlay */}
        {verifying && (
          <View style={styles.verifyingOverlay}>
            <View style={[styles.verifyingCard, { backgroundColor: colors.cardBg }]}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.verifyingTitle, { color: colors.black }]}>
                Confirming Payment...
              </Text>
              <Text style={[styles.verifyingDesc, { color: colors.gray500 }]}>
                Waiting for mobile money confirmation.{'\n'}This may take up to 2 minutes.
              </Text>
            </View>
          </View>
        )}

        {/* WebView */}
        {paymentLink && !verifying && (
          <WebView
            ref={webViewRef}
            source={{ uri: paymentLink }}
            onNavigationStateChange={handleNavigationChange}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            style={styles.webview}
          />
        )}

        {/* Loading indicator */}
        {loading && !verifying && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.gray500 }]}>
              Loading checkout...
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
  },
  verifyingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  verifyingCard: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    gap: 16,
  },
  verifyingTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  verifyingDesc: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
});
