import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import { GraffitiFlame } from '../components/icons';
import { SpraySplatter } from '../components/GraffitiAccents';
import Button from '../components/Button';
import PurchaseModal from '../components/PurchaseModal';
import BoostPulseRing from '../components/BoostPulseRing';
import { useSubscription, PRODUCT_IDS } from '../payments';
import { formatPerUnit } from '../payments/pricing';

// Fallback packs (USD) — replaced by localized prices when RevenueCat is active
const PACKS_FALLBACK = [
  { count: 1, price: '$5.99', perUnit: '$5.99/each', save: null, productId: PRODUCT_IDS.SPOTLIGHT_1 },
  { count: 5, price: '$19.99', perUnit: '$3.99/each', save: 'Save 33%', productId: PRODUCT_IDS.SPOTLIGHT_5 },
  { count: 10, price: '$29.99', perUnit: '$2.99/each', save: null, productId: PRODUCT_IDS.SPOTLIGHT_10 },
];

function buildPacks(offerings) {
  if (!offerings?.availablePackages?.length) return PACKS_FALLBACK;

  const pkgMap = {};
  for (const pkg of offerings.availablePackages) {
    pkgMap[pkg.product.identifier] = pkg;
  }

  return PACKS_FALLBACK.map((fallback) => {
    const pkg = pkgMap[fallback.productId];
    if (!pkg) return fallback;

    const priceStr = pkg.product.priceString;
    const perUnit = formatPerUnit(pkg.product, fallback.count);

    return {
      ...fallback,
      price: priceStr,
      perUnit,
      rcPackage: pkg,
    };
  });
}

export default function BoostScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [selected, setSelected] = useState(1);
  const { purchase, spotlights, purchaseInProgress, offerings } = useSubscription();
  const [modal, setModal] = useState({ visible: false, type: 'loading', title: '', message: '' });

  const PACKS = buildPacks(offerings);
  const selectedPack = PACKS[selected];

  const handleBuy = async () => {
    const pack = PACKS[selected];
    setModal({ visible: true, type: 'loading', title: 'Processing...', message: `Getting ${pack.count} Spotlight${pack.count > 1 ? 's' : ''}` });

    // Use RevenueCat package if available, otherwise fall back to product ID
    const purchaseTarget = pack.rcPackage || pack.productId;
    const result = await purchase(purchaseTarget);

    if (result.success) {
      setModal({ visible: true, type: 'success', title: 'Spotlights Added!', message: `${pack.count} Spotlight${pack.count > 1 ? 's' : ''} added to your account!` });
    } else if (result.error === 'cancelled') {
      setModal((m) => ({ ...m, visible: false }));
    } else {
      setModal({ visible: true, type: 'error', title: 'Purchase Failed', message: result.error || 'Please try again.' });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <View style={styles.closeBtnBg}>
          <Ionicons name="close" size={24} color={colors.black} />
        </View>
      </TouchableOpacity>

      {/* Ambient spray accents */}
      <View style={{ position: 'absolute', right: 16, top: 120 }} pointerEvents="none">
        <SpraySplatter size={35} color="#009739" opacity={0.06} />
      </View>
      <View style={{ position: 'absolute', left: 12, bottom: 160 }} pointerEvents="none">
        <SpraySplatter size={40} color="#CE1126" opacity={0.05} />
      </View>

      {/* Lightning icon with glow + pulse rings */}
      <View style={styles.iconContainer}>
        <BoostPulseRing size={60} />
        <View style={styles.iconGlow} />
        <GraffitiFlame size={60} color={colors.accent} filled />
      </View>

      <Text style={styles.title}>Get In The Spotlight</Text>

      <Text style={styles.subtitle}>
        Put your profile at the top of the stack — be the first person seen in your area!
      </Text>

      {/* Current count */}
      <View style={styles.countBadge}>
        <GraffitiFlame size={16} color={colors.accent} filled />
        <Text style={styles.countText}>{spotlights} spotlight{spotlights !== 1 ? 's' : ''} remaining</Text>
      </View>

      {/* Pack options */}
      <View style={styles.packsRow}>
        {PACKS.map((pack, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.packCard, selected === index && styles.packSelected]}
            onPress={() => setSelected(index)}
            activeOpacity={0.7}
          >
            {pack.save && (
              <View style={styles.saveBadge}>
                <Text style={styles.saveText}>{pack.save}</Text>
              </View>
            )}
            <Text style={[styles.packCount, selected === index && styles.packCountActive]}>
              {pack.count}
            </Text>
            <Text style={[styles.packLabel, selected === index && styles.packLabelActive]}>
              Pack
            </Text>
            <Text style={[styles.packPrice, selected === index && styles.packPriceActive]}>
              {pack.perUnit}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Buy button */}
      <View style={styles.btnSection}>
        <Button
          title={`Get ${selectedPack.count} Spotlight${selectedPack.count > 1 ? 's' : ''} for ${selectedPack.price}`}
          variant="primary"
          size="lg"
          loading={purchaseInProgress}
          onPress={handleBuy}
        />
      </View>

      <View style={styles.divider}>
        <Text style={styles.dividerText}>or upgrade</Text>
      </View>

      {/* Junub upsell */}
      <Button
        title="Go Junub"
        subtitle="Get 1 Free Spotlight/Month and More"
        variant="outline"
        size="lg"
        onPress={() => navigation.navigate('Elite')}
      />

      <View style={{ marginTop: 20 }}>
        <Button
          title="No Thanks"
          variant="ghost"
          size="md"
          onPress={() => navigation.goBack()}
        />
      </View>

      <PurchaseModal
        visible={modal.visible}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onDismiss={() => {
          setModal((m) => ({ ...m, visible: false }));
          if (modal.type === 'success') navigation.goBack();
        }}
      />
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  closeBtn: {
    alignSelf: 'flex-start',
    padding: 8,
  },
  closeBtnBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
  },
  iconContainer: {
    marginTop: 24,
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8E8EC',
  },
  title: {
    ...Typography.h1,
    color: colors.black,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.bodySmall,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
    lineHeight: 22,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#ECECF0',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 24,
  },
  countText: {
    ...Typography.label,
    color: colors.accent,
  },
  packsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  packCard: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.gray100,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.gray200,
  },
  packSelected: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : colors.cardBg,
    borderColor: colors.accent,
    borderWidth: 2,
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  saveBadge: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: 'absolute',
    top: -12,
  },
  saveText: {
    ...Typography.captionBold,
    color: '#FFFFFF',
    fontSize: 11,
  },
  packCount: {
    fontSize: 36,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.gray500,
    marginTop: 10,
  },
  packCountActive: {
    color: colors.accent,
  },
  packLabel: {
    ...Typography.label,
    color: colors.gray400,
    marginTop: -2,
  },
  packLabelActive: {
    color: colors.gray600,
  },
  packPrice: {
    ...Typography.label,
    color: colors.gray400,
    marginTop: 8,
  },
  packPriceActive: {
    color: colors.black,
  },
  btnSection: {
    width: '100%',
    marginTop: 28,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 24,
    gap: 10,
  },
  dividerText: {
    ...Typography.label,
    color: colors.gray400,
  },
});
