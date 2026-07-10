import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription, SHOW_PAYMENTS_UI } from '../payments';
import { PRODUCT_IDS } from '../payments/products';
import PaymentMethodSelector from './PaymentMethodSelector';
import StripeCheckout from './StripeCheckout';
import { PAYMENT_METHODS } from '../payments/paymentMethods';
import { useCurrentUser } from '../hooks';

const COIN_PACKS = [
  { id: PRODUCT_IDS.COINS_100, coins: 100, price: '$1.99' },
  { id: PRODUCT_IDS.COINS_500, coins: 500, price: '$7.99', badge: 'POPULAR' },
  { id: PRODUCT_IDS.COINS_1200, coins: 1200, price: '$14.99', badge: 'BEST VALUE' },
];

// v1 launch: never render the coin-purchase UI. Coins are infinite for
// every user (consumeCoins always succeeds via ALL_FEATURES_FREE), so
// there's no need to surface a sheet that would otherwise hit the
// disabled payment path. App Review wouldn't let us ship a non-
// functional purchase sheet anyway.
export default function CoinPurchaseSheet(props) {
  if (!SHOW_PAYMENTS_UI) return null;
  return <CoinPurchaseSheetImpl {...props} />;
}

function CoinPurchaseSheetImpl({ visible, onClose }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    coins,
    purchase,
    purchaseWithStripe,
    confirmStripePayment,
    purchaseInProgress,
  } = useSubscription();
  const { currentUser } = useCurrentUser();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [selectedPack, setSelectedPack] = useState(null);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [stripeCheckout, setStripeCheckout] = useState(null); // { url, sessionId }

  const countryCode = currentUser?.countryCode || 'US';

  const handleSelectPack = (pack) => {
    setSelectedPack(pack);
    setShowPaymentMethods(true);
  };

  const handlePaymentMethod = async (method) => {
    if (!selectedPack) return;

    if (method === PAYMENT_METHODS.STRIPE) {
      // Primary path — Stripe Checkout in a WebView modal.
      const result = await purchaseWithStripe({ productId: selectedPack.id });
      if (result.success && result.url) {
        setStripeCheckout({ url: result.url, sessionId: result.sessionId });
      }
      return;
    }

    if (method === PAYMENT_METHODS.APP_STORE) {
      // iOS / Android IAP via RevenueCat
      const result = await purchase(selectedPack.id);
      if (result.success) onClose?.();
    }
  };

  const handleStripeSuccess = async (sessionId) => {
    setStripeCheckout(null);
    await confirmStripePayment(sessionId);
    onClose?.();
  };

  const handleStripeCancel = () => setStripeCheckout(null);
  const handleStripeError = () => setStripeCheckout(null);

  const getPrice = (pack) => pack.price;

  return (
    <>
      <Modal visible={visible && !stripeCheckout} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>Get Coins</Text>
              <View style={styles.balance}>
                <Ionicons name="wallet" size={16} color={colors.gold} />
                <Text style={styles.balanceText}>{coins}</Text>
              </View>
            </View>

            <Text style={styles.desc}>Use coins to send gifts, buy event tickets, and more.</Text>

            <View style={styles.packs}>
              {COIN_PACKS.map((pack) => (
                <TouchableOpacity
                  key={pack.id}
                  style={styles.pack}
                  onPress={() => handleSelectPack(pack)}
                  activeOpacity={0.8}
                  disabled={purchaseInProgress}
                >
                  <View style={styles.packLeft}>
                    <Ionicons name="ellipse" size={10} color={colors.gold} />
                    <Text style={styles.packCoins}>{pack.coins.toLocaleString()} coins</Text>
                  </View>
                  {pack.badge && (
                    <View style={[styles.packBadge, pack.badge === 'BEST VALUE' && { backgroundColor: colors.green }]}>
                      <Text style={styles.packBadgeText}>{pack.badge}</Text>
                    </View>
                  )}
                  <Text style={styles.packPrice}>{getPrice(pack)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      <PaymentMethodSelector
        visible={showPaymentMethods}
        onClose={() => setShowPaymentMethods(false)}
        onSelect={handlePaymentMethod}
        countryCode={countryCode}
        productLabel={selectedPack ? `${selectedPack.coins} coins` : ''}
        priceLabel={selectedPack ? getPrice(selectedPack) : ''}
      />

      {stripeCheckout && (
        <StripeCheckout
          visible={!!stripeCheckout}
          url={stripeCheckout.url}
          sessionId={stripeCheckout.sessionId}
          onSuccess={handleStripeSuccess}
          onCancel={handleStripeCancel}
          onError={handleStripeError}
        />
      )}
    </>
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
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
    alignSelf: 'center',
    marginTop: 8, marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
  },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(252,205,18,0.1)' : 'rgba(252,205,18,0.08)',
  },
  balanceText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
  },
  desc: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    marginBottom: 20,
  },
  packs: { gap: 10 },
  pack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.separator,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)',
  },
  packLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packCoins: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
  },
  packBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.accent,
    marginRight: 12,
  },
  packBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  packPrice: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
  },
});
