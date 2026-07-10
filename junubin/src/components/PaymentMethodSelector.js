/**
 * PaymentMethodSelector
 *
 * Bottom sheet that lets users choose how to pay: Stripe (card or
 * wallet) or App Store IAP. On iOS we only surface IAP, so the sheet
 * auto-dispatches without ever rendering; on Android the user picks
 * between Stripe and Play IAP.
 *
 * Props:
 *   visible - boolean to show/hide
 *   onClose - callback to dismiss
 *   onSelect(method) - callback with selected PAYMENT_METHODS value
 *   countryCode - retained for API compatibility (unused)
 *   productLabel - what they're buying (e.g. "JuNubin+ Monthly")
 *   priceLabel - formatted price string (e.g. "$9.99")
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Typography } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_ICONS,
  PAYMENT_METHOD_COLORS,
  getAvailableMethods,
} from '../payments/paymentMethods';

export default function PaymentMethodSelector({
  visible,
  onClose,
  onSelect,
  countryCode = 'KE',
  productLabel = '',
  priceLabel = '',
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const methods = useMemo(
    () => getAvailableMethods(countryCode, Platform.OS),
    [countryCode]
  );

  // If only one method is available (e.g. iOS where Apple policy
  // forces IAP-only for digital goods), bypass the sheet entirely and
  // dispatch directly so the user doesn't see a single-row picker.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      autoSelectedRef.current = false;
      return;
    }
    if (methods.length === 1 && !autoSelectedRef.current) {
      autoSelectedRef.current = true;
      const only = methods[0];
      onSelect?.(only);
      onClose?.();
    }
  }, [visible, methods, onSelect, onClose]);

  if (methods.length <= 1) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onStartShouldSetResponder={() => true}>
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Choose Payment Method</Text>
          {productLabel ? (
            <Text style={styles.subtitle}>
              {productLabel}{priceLabel ? ` \u00B7 ${priceLabel}` : ''}
            </Text>
          ) : null}

          {/* Methods */}
          <View style={styles.methodsList}>
            {methods.map((method) => {
              const label = PAYMENT_METHOD_LABELS[method];
              const icon = PAYMENT_METHOD_ICONS[method];
              const color = PAYMENT_METHOD_COLORS[method];
              const isAppStore = method === PAYMENT_METHODS.APP_STORE;

              return (
                <TouchableOpacity
                  key={method}
                  style={styles.methodRow}
                  onPress={() => { onSelect(method); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.methodIcon, { backgroundColor: color + '15' }]}>
                    <Ionicons name={icon} size={20} color={color} />
                  </View>
                  <View style={styles.methodInfo}>
                    <View style={styles.methodLabelRow}>
                      <Text style={styles.methodLabel}>{label}</Text>
                      {method === PAYMENT_METHODS.STRIPE && (
                        <View style={styles.recommendBadge}>
                          <Text style={styles.recommendBadgeText}>RECOMMENDED</Text>
                        </View>
                      )}
                    </View>
                    {method === PAYMENT_METHODS.STRIPE && (
                      <Text style={styles.methodDesc}>
                        Visa, Mastercard, Amex, Apple Pay, Google Pay, Link — worldwide
                      </Text>
                    )}
                    {isAppStore && (
                      <Text style={styles.methodDesc}>
                        {Platform.OS === 'ios' ? 'Apple Pay, cards via App Store' : 'Google Pay, cards via Play Store'}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Security note */}
          <View style={styles.securityRow}>
            <Ionicons name="shield-checkmark" size={14} color={colors.gray400} />
            <Text style={styles.securityText}>
              Payments secured by Stripe, Apple, and Google. Your details are encrypted.
            </Text>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
  },
  title: {
    ...Typography.h3,
    color: colors.black,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    ...Typography.caption,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  methodsList: {
    gap: 2,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : colors.separator,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  methodInfo: {
    flex: 1,
  },
  methodLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  methodLabel: {
    ...Typography.bodySmallMedium,
    color: colors.black,
  },
  recommendBadge: {
    backgroundColor: '#635BFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recommendBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  methodDesc: {
    ...Typography.caption,
    fontSize: 12,
    color: colors.gray500,
    marginTop: 1,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 16,
  },
  securityText: {
    ...Typography.caption,
    fontSize: 11,
    color: colors.gray400,
  },
});
