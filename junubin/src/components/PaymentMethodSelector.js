/**
 * PaymentMethodSelector
 *
 * Bottom sheet that lets users choose how to pay:
 * App Store, M-Pesa, MTN MoMo, Airtel Money, Bank Transfer, or Card.
 *
 * Available methods are filtered based on the user's country.
 * Props:
 *   visible - boolean to show/hide
 *   onClose - callback to dismiss
 *   onSelect(method) - callback with selected PAYMENT_METHODS value
 *   countryCode - user's ISO country code
 *   productLabel - what they're buying (e.g. "JuNubin+ Monthly")
 *   priceLabel - formatted price string (e.g. "KSh 1,500")
 */

import React, { useMemo } from 'react';
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
} from '../payments/FlutterwaveService';

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
                    <Text style={styles.methodLabel}>{label}</Text>
                    {isAppStore && (
                      <Text style={styles.methodDesc}>
                        {Platform.OS === 'ios' ? 'Apple Pay, cards via App Store' : 'Google Pay, cards via Play Store'}
                      </Text>
                    )}
                    {method === PAYMENT_METHODS.MPESA && (
                      <Text style={styles.methodDesc}>Safaricom M-Pesa STK push</Text>
                    )}
                    {method === PAYMENT_METHODS.MTN_MOMO && (
                      <Text style={styles.methodDesc}>MTN Mobile Money</Text>
                    )}
                    {method === PAYMENT_METHODS.AIRTEL_MONEY && (
                      <Text style={styles.methodDesc}>Airtel Money mobile wallet</Text>
                    )}
                    {method === PAYMENT_METHODS.BANK_TRANSFER && (
                      <Text style={styles.methodDesc}>Direct bank transfer</Text>
                    )}
                    {method === PAYMENT_METHODS.CARD && (
                      <Text style={styles.methodDesc}>Visa, Mastercard, Amex, Verve — worldwide</Text>
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
              Payments secured by Flutterwave. Your details are encrypted.
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
  methodLabel: {
    ...Typography.bodySmallMedium,
    color: colors.black,
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
