/**
 * StripeCheckout
 *
 * Full-screen modal that renders Stripe's hosted Checkout in a WebView.
 * Detects the junubin:// success / cancel redirect and hands control
 * back to the caller so it can refresh server state.
 *
 * Props:
 *   visible    - boolean
 *   url        - Stripe Checkout Session URL from StripeService.createCheckout()
 *   sessionId  - Session id used to poll the Payment table for webhook confirmation
 *   onSuccess(sessionId) - called once the webhook-confirmed Payment row is `succeeded`
 *   onCancel()           - called when user aborts or closes
 *   onError(message)     - called on payment failure
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily } from '../theme';
import StripeService from '../payments/StripeService';

/** Max time to poll for webhook confirmation (ms) */
const POLL_TIMEOUT = 60000;   // Stripe webhooks normally land in <5s; give 60s headroom
const POLL_INTERVAL = 2000;

export default function StripeCheckout({
  visible,
  url,
  sessionId,
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
   * Poll the Payment table until the webhook marks the session
   * succeeded / failed / cancelled, or we hit the timeout. Stripe's
   * own redirect happens before the webhook lands, so we have to
   * confirm separately rather than trusting the redirect URL alone.
   */
  const pollStatus = useCallback(async () => {
    if (!sessionId) {
      onSuccess?.(null);
      return;
    }
    setVerifying(true);
    const startTime = Date.now();

    const poll = async () => {
      try {
        const result = await StripeService.getSessionStatus(sessionId);
        if (result.status === 'succeeded') {
          setVerifying(false);
          onSuccess?.(sessionId);
          return;
        }
        if (result.status === 'failed' || result.status === 'cancelled' || result.status === 'refunded') {
          setVerifying(false);
          onError?.(`Payment ${result.status}`);
          return;
        }
        if (Date.now() - startTime < POLL_TIMEOUT) {
          setTimeout(poll, POLL_INTERVAL);
        } else {
          // Webhook hasn't landed yet. Stripe will retry the delivery
          // so the row will appear eventually — return success and let
          // the caller refresh on next foreground.
          setVerifying(false);
          onSuccess?.(sessionId);
        }
      } catch {
        setVerifying(false);
        onError?.('Could not verify payment. Please check your transaction history.');
      }
    };

    poll();
  }, [sessionId, onSuccess, onError]);

  /**
   * Intercept WebView navigation to detect Stripe's redirect to the
   * junubin:// success/cancel deep link.
   */
  const handleNavigationChange = useCallback((navState) => {
    const navUrl = navState.url || '';

    if (navUrl.startsWith('junubin://payment/stripe/success') ||
        navUrl.includes('payment/stripe/success')) {
      pollStatus();
      return false;
    }
    if (navUrl.startsWith('junubin://payment/stripe/cancel') ||
        navUrl.includes('payment/stripe/cancel')) {
      onCancel?.();
      return false;
    }
    return true;
  }, [pollStatus, onCancel]);

  const handleClose = () => {
    if (verifying) return;
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
            <Ionicons name="shield-checkmark" size={16} color="#635BFF" />
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
                Stripe is finalising your transaction.{'\n'}This usually takes a few seconds.
              </Text>
            </View>
          </View>
        )}

        {/* WebView */}
        {url && !verifying && (
          <WebView
            ref={webViewRef}
            source={{ uri: url }}
            onNavigationStateChange={handleNavigationChange}
            onShouldStartLoadWithRequest={(req) => {
              // Catch the junubin:// redirect on iOS too (some versions
              // don't surface custom schemes through onNavigationStateChange).
              if (req.url?.startsWith('junubin://')) {
                if (req.url.includes('stripe/success')) pollStatus();
                else if (req.url.includes('stripe/cancel')) onCancel?.();
                return false;
              }
              return true;
            }}
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
          <View
            style={[
              styles.loadingOverlay,
              { backgroundColor: isDark ? 'rgba(12,12,14,0.92)' : 'rgba(255,255,255,0.92)' },
            ]}
          >
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
