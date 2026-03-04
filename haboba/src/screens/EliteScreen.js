import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import Button from '../components/Button';
import PurchaseModal from '../components/PurchaseModal';
import { useSubscription, PRODUCT_IDS } from '../payments';

const { width } = Dimensions.get('window');

// ── Two tiers, each with distinct value props ──

const PLUS_FEATURES = [
  { icon: 'heart', title: 'Like Without Limits', desc: 'Swipe right as much as you want — no daily cap holding you back.' },
  { icon: 'refresh', title: 'Unlimited Rewinds', desc: 'Accidentally passed on someone? Bring them back instantly.' },
  { icon: 'chatbubble', title: 'Read Receipts', desc: 'Know when your messages have been seen.' },
  { icon: 'shield-checkmark', title: 'No Ads. Ever.', desc: 'Your experience is yours — clean, focused, respectful.' },
];

const JUNUB_FEATURES = [
  { icon: 'eye', title: 'See Who Likes You', desc: 'Don\'t wait to be found — see everyone who\'s already interested.' },
  { icon: 'flash', title: '1 Free Spotlight/Month', desc: 'Jump to the top of the stack every month, on us.' },
  { icon: 'globe', title: 'Diaspora Connect', desc: 'Match across cities and countries — connect the South Sudanese diaspora worldwide.' },
  { icon: 'options', title: 'Advanced Filters', desc: 'Filter by ethnicity, religion, intentions, and more.' },
  { icon: 'eye-off', title: 'Incognito Mode', desc: 'Browse invisibly. Only people you like will know you exist.' },
  { icon: 'star', title: 'Everything in JuNubin+', desc: 'Unlimited likes, rewinds, read receipts — all included.' },
];

// Fallback plans (used when RevenueCat offerings aren't available)
const PLUS_PLANS_FALLBACK = [
  { duration: '1', unit: 'Month', price: '$9.99', perMonth: '$9.99/mo', save: null, productId: PRODUCT_IDS.PLUS_MONTHLY },
  { duration: '6', unit: 'Months', price: '$39.99', perMonth: '$6.66/mo', save: 'Save 33%', productId: PRODUCT_IDS.PLUS_6MONTH },
];

const JUNUB_PLANS_FALLBACK = [
  { duration: '1', unit: 'Month', price: '$19.99', perMonth: '$19.99/mo', save: null, productId: PRODUCT_IDS.JUNUB_MONTHLY },
  { duration: '6', unit: 'Months', price: '$79.99', perMonth: '$13.33/mo', save: 'Save 33%', productId: PRODUCT_IDS.JUNUB_6MONTH },
];

/**
 * Build plan cards from RevenueCat offering packages (localized prices).
 * Falls back to hardcoded USD if offerings aren't available.
 */
function buildPlans(offerings, tier) {
  const fallback = tier === 'junub' ? JUNUB_PLANS_FALLBACK : PLUS_PLANS_FALLBACK;
  if (!offerings?.availablePackages?.length) return { plans: fallback, packages: {} };

  const monthlyId = tier === 'junub' ? PRODUCT_IDS.JUNUB_MONTHLY : PRODUCT_IDS.PLUS_MONTHLY;
  const sixMonthId = tier === 'junub' ? PRODUCT_IDS.JUNUB_6MONTH : PRODUCT_IDS.PLUS_6MONTH;

  const pkgMap = {};
  for (const pkg of offerings.availablePackages) {
    pkgMap[pkg.product.identifier] = pkg;
  }

  const monthlyPkg = pkgMap[monthlyId];
  const sixMonthPkg = pkgMap[sixMonthId];

  const plans = [];

  if (monthlyPkg) {
    plans.push({
      duration: '1',
      unit: 'Month',
      price: monthlyPkg.product.priceString,
      perMonth: `${monthlyPkg.product.priceString}/mo`,
      save: null,
      productId: monthlyId,
      rcPackage: monthlyPkg,
    });
  } else {
    plans.push(fallback[0]);
  }

  if (sixMonthPkg) {
    plans.push({
      duration: '6',
      unit: 'Months',
      price: sixMonthPkg.product.priceString,
      perMonth: `${sixMonthPkg.product.priceString.replace(/[\d.,]+/, (n) => (parseFloat(n.replace(',', '.')) / 6).toFixed(2))}/mo`,
      save: 'Save 33%',
      productId: sixMonthId,
      rcPackage: sixMonthPkg,
    });
  } else {
    plans.push(fallback[1]);
  }

  return { plans, packages: pkgMap };
}

export default function EliteScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [selectedTier, setSelectedTier] = useState('junub');
  const [selectedPlan, setSelectedPlan] = useState(1);
  const scrollRef = useRef(null);
  const [featureIndex, setFeatureIndex] = useState(0);
  const { purchase, restorePurchases, tier, hasTier, purchaseInProgress, offerings } = useSubscription();
  const [modal, setModal] = useState({ visible: false, type: 'loading', title: '', message: '' });
  const tierSlide = useRef(new Animated.Value(1)).current;
  const [tierTabWidth, setTierTabWidth] = useState(0);

  const features = selectedTier === 'junub' ? JUNUB_FEATURES : PLUS_FEATURES;
  const { plans } = buildPlans(offerings, selectedTier);
  const tierLabel = selectedTier === 'junub' ? 'Junub' : 'JuNubin+';

  // Staggered feature slide animations
  const featureAnimsRef = useRef([]);
  const hasAnimatedFeaturesRef = useRef(false);

  useEffect(() => {
    if (hasAnimatedFeaturesRef.current) return;
    hasAnimatedFeaturesRef.current = true;
    const maxFeatures = Math.max(JUNUB_FEATURES.length, PLUS_FEATURES.length);
    const anims = Array.from({ length: maxFeatures }, () => new Animated.Value(0));
    featureAnimsRef.current = anims;
    const staggered = anims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 280,
        delay: i * 50,
        useNativeDriver: true,
      })
    );
    Animated.stagger(0, staggered).start();
  }, []);

  const inactiveColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';

  const handleScroll = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (width - 40));
    setFeatureIndex(index);
  };

  const handleTierSwitch = useCallback((newTier) => {
    Animated.spring(tierSlide, {
      toValue: newTier === 'junub' ? 1 : 0,
      useNativeDriver: false,
      tension: 68,
      friction: 12,
    }).start();
    setSelectedTier(newTier);
    setSelectedPlan(1);
    setFeatureIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [tierSlide]);

  const handleSubscribe = async () => {
    const plan = plans[selectedPlan];
    setModal({ visible: true, type: 'loading', title: 'Processing...', message: `Subscribing to ${tierLabel}` });

    // Use RevenueCat package if available, otherwise fall back to product ID
    const purchaseTarget = plan.rcPackage || plan.productId;
    const result = await purchase(purchaseTarget);

    if (result.success) {
      setModal({
        visible: true,
        type: 'success',
        title: selectedTier === 'junub' ? 'Welcome to Junub!' : 'Welcome to JuNubin+!',
        message: `You're in. Enjoy your new features.`,
      });
    } else if (result.error === 'cancelled') {
      setModal((m) => ({ ...m, visible: false }));
    } else {
      setModal({ visible: true, type: 'error', title: 'Purchase Failed', message: result.error || 'Please try again.' });
    }
  };

  const alreadyHasTier = hasTier(selectedTier);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Close */}
      <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()}>
        <View style={styles.closeBtnGlass}>
          <Ionicons name="close" size={28} color={colors.black} />
        </View>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        {/* No-ads badge */}
        <View style={styles.noAdsBadge}>
          <Ionicons name="shield-checkmark" size={14} color={colors.accent} />
          <Text style={styles.noAdsText}>No ads. Ever.</Text>
        </View>

        {/* Tier tab switcher — compact pill */}
        <View
          style={styles.tierTabs}
          onLayout={(e) => setTierTabWidth(e.nativeEvent.layout.width - 4)}
        >
          {tierTabWidth > 0 && (
            <Animated.View
              style={[
                styles.tierPill,
                {
                  width: tierTabWidth / 2,
                  transform: [{
                    translateX: tierSlide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, tierTabWidth / 2],
                    }),
                  }],
                },
              ]}
            />
          )}
          {[
            { key: 'plus', label: 'JuNubin+' },
            { key: 'junub', label: 'Junub' },
          ].map((t) => (
            <TouchableOpacity
              key={t.key}
              style={styles.tierTab}
              onPress={() => handleTierSwitch(t.key)}
              activeOpacity={0.7}
            >
              <Animated.Text
                style={[
                  styles.tierTabText,
                  {
                    color: tierSlide.interpolate({
                      inputRange: [0, 1],
                      outputRange: t.key === 'plus'
                        ? ['#FFFFFF', inactiveColor]
                        : [inactiveColor, '#FFFFFF'],
                    }),
                  },
                ]}
              >
                {t.label}
              </Animated.Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tier branding */}
        <View style={styles.brandRow}>
          <View style={styles.brandLine} />
          <Text style={styles.brandText}>{tierLabel}</Text>
          <View style={styles.brandLine} />
        </View>

        {selectedTier === 'junub' && (
          <Text style={styles.junubMeaning}>
            "South" — connecting South Sudanese everywhere
          </Text>
        )}

        {alreadyHasTier && (
          <View style={styles.currentBadge}>
            <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
            <Text style={styles.currentBadgeText}>Current Plan</Text>
          </View>
        )}

        {/* Feature carousel */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={styles.carousel}
        >
          {features.map((feature, index) => {
            const featureAnim = featureAnimsRef.current[index];
            const featureAnimStyle = featureAnim ? {
              opacity: featureAnim,
              transform: [{
                translateX: featureAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              }],
            } : {};
            return (
              <Animated.View key={index} style={[styles.featureSlide, featureAnimStyle]}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name={feature.icon} size={52} color={colors.accent} />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </Animated.View>
            );
          })}
        </ScrollView>

        {/* Pagination dots */}
        <View style={styles.dots}>
          {features.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, featureIndex === index && styles.dotActive]}
            />
          ))}
        </View>

        {/* Social mode callout */}
        <View style={styles.socialCallout}>
          <Ionicons name="people" size={18} color={colors.accent} />
          <Text style={styles.socialCalloutText}>Socializing mode is always free for everyone</Text>
        </View>

        {/* Plan cards */}
        {!alreadyHasTier && (
          <>
            <View style={styles.plansRow}>
              {plans.map((plan, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.planCard, selectedPlan === index && styles.planSelected]}
                  onPress={() => setSelectedPlan(index)}
                  activeOpacity={0.7}
                >
                  {plan.save && (
                    <View style={styles.saveBadge}>
                      <Text style={styles.saveText}>{plan.save}</Text>
                    </View>
                  )}
                  <Text style={[styles.planDuration, selectedPlan === index && styles.planDurationActive]}>
                    {plan.duration}
                  </Text>
                  <Text style={[styles.planUnit, selectedPlan === index && styles.planUnitActive]}>
                    {plan.unit}
                  </Text>
                  <Text style={[styles.planPrice, selectedPlan === index && styles.planPriceActive]}>
                    {plan.perMonth}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Terms */}
            <Text style={styles.terms}>
              By tapping below, you agree to our{' '}
              <Text style={styles.termsLink}>TERMS</Text>. Your subscription auto-renews
              at the same price until you cancel via Account Settings.
            </Text>

            {/* Subscribe button */}
            <View style={styles.btnSection}>
              <Button
                title={`Get ${tierLabel} for ${plans[selectedPlan].price}`}
                variant="primary"
                size="lg"
                loading={purchaseInProgress}
                onPress={handleSubscribe}
              />
            </View>

            {/* Restore purchases */}
            <TouchableOpacity style={styles.restoreBtn} onPress={async () => {
              setModal({ visible: true, type: 'loading', title: 'Restoring...', message: 'Checking your previous purchases' });
              const result = await restorePurchases();
              if (result.success) {
                setModal({ visible: true, type: 'success', title: 'Restored!', message: 'Your purchases have been restored.' });
              } else {
                setModal({ visible: true, type: 'error', title: 'Restore Failed', message: result.error || 'Please try again.' });
              }
            }}>
              <Text style={styles.restoreText}>Restore Purchases</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

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
    backgroundColor: colors.white,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  closeBtnGlass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.separator,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },

  // No-ads badge
  noAdsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentTint08,
    borderWidth: 1,
    borderColor: colors.accentTint15,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  noAdsText: {
    ...Typography.label,
    color: colors.accent,
    fontSize: 12,
    letterSpacing: 1,
  },

  // Tier tab switcher — compact
  tierTabs: {
    flexDirection: 'row',
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    borderRadius: 20,
    padding: 2,
    alignSelf: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  tierPill: {
    position: 'absolute',
    top: 2,
    left: 2,
    bottom: 2,
    borderRadius: 18,
    backgroundColor: colors.accent,
  },
  tierTab: {
    paddingVertical: 7,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tierTabText: {
    fontSize: 16,
    fontFamily: FontFamily.script,
  },

  // Brand
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  brandLine: {
    height: 2,
    flex: 1,
    backgroundColor: colors.accent,
  },
  brandText: {
    fontFamily: FontFamily.script,
    fontSize: 42,
    color: colors.accent,
    letterSpacing: 0.5,
  },
  junubMeaning: {
    ...Typography.caption,
    color: colors.gray500,
    fontStyle: 'italic',
    marginBottom: 16,
    textAlign: 'center',
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentTint08,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  currentBadgeText: {
    ...Typography.label,
    color: colors.accent,
  },

  // Carousel
  carousel: {
    width: width,
  },
  featureSlide: {
    width: width - 40,
    marginHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 24,
  },
  featureIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentTint06,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    ...Typography.h2,
    color: colors.black,
    marginTop: 8,
    textAlign: 'center',
  },
  featureDesc: {
    ...Typography.bodySmall,
    color: colors.gray500,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray300,
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },

  // Social callout
  socialCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.cream,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.separator,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 24,
    width: '100%',
  },
  socialCalloutText: {
    ...Typography.bodySmall,
    color: colors.gray500,
    flex: 1,
  },

  // Plans
  plansRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 4,
  },
  planCard: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.cardBg,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.separator,
    position: 'relative',
  },
  planSelected: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 2,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  saveBadge: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    position: 'absolute',
    top: -10,
  },
  saveText: {
    ...Typography.captionBold,
    color: '#FFFFFF',
    fontSize: 10,
  },
  planDuration: {
    fontSize: 32,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.gray400,
    marginTop: 8,
  },
  planDurationActive: {
    color: colors.accent,
  },
  planUnit: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: 2,
  },
  planUnitActive: {
    color: colors.gray600,
  },
  planPrice: {
    ...Typography.label,
    color: colors.gray400,
    marginTop: 10,
  },
  planPriceActive: {
    color: colors.accent,
  },
  terms: {
    ...Typography.caption,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 28,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  termsLink: {
    color: colors.accent,
    fontWeight: '700',
  },
  btnSection: {
    width: '100%',
    marginTop: 24,
  },
  restoreBtn: {
    marginTop: 18,
  },
  restoreText: {
    ...Typography.bodySemibold,
    color: colors.black,
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
