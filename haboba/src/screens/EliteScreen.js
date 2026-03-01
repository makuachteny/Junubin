import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, FontFamily } from '../theme';
import Button from '../components/Button';
import PurchaseModal from '../components/PurchaseModal';
import { useSubscription, PRODUCT_IDS } from '../payments';

const { width } = Dimensions.get('window');

const FEATURES = [
  { icon: 'heart', title: 'Like Without Limits', desc: 'Increase your chances of matching by liking as many people as you want!' },
  { icon: 'eye', title: 'See Who Likes You', desc: 'Don\'t wait to be found — see everyone who\'s already interested!' },
  { icon: 'flash', title: '1 Free Spotlight/Month', desc: 'Get your profile to the top of the stack every month.' },
  { icon: 'star', title: 'Unlimited Rewinds', desc: 'Accidentally swiped left? Go back and fix it!' },
  { icon: 'shield-checkmark', title: 'Advanced Filters', desc: 'Filter by recently active, subscribers, and new members.' },
  { icon: 'eye-off', title: 'Incognito Mode', desc: 'Browse profiles without being seen. Like someone? They\'ll know then.' },
];

const PLANS = [
  { duration: '1', unit: 'Week', price: '$21.99', perMonth: null, save: null, productId: PRODUCT_IDS.ROYAL_WEEKLY },
  { duration: '1', unit: 'Month', price: '$29.99', perMonth: '$29.99/mo', save: 'Save 66%', productId: PRODUCT_IDS.ROYAL_MONTHLY },
  { duration: '3', unit: 'Months', price: '$59.99', perMonth: '$19.99/mo', save: 'Save 77%', productId: PRODUCT_IDS.ROYAL_3MONTH },
  { duration: '6', unit: 'Months', price: '$71.99', perMonth: '$11.99/mo', save: 'Save 86%', productId: PRODUCT_IDS.ROYAL_6MONTH },
];

export default function EliteScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState(2);
  const scrollRef = useRef(null);
  const [featureIndex, setFeatureIndex] = useState(0);
  const { purchase, tier, hasTier, purchaseInProgress } = useSubscription();
  const [modal, setModal] = useState({ visible: false, type: 'loading', title: '', message: '' });

  const handleScroll = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (width - 40));
    setFeatureIndex(index);
  };

  const handleSubscribe = async () => {
    const plan = PLANS[selectedPlan];
    setModal({ visible: true, type: 'loading', title: 'Processing...', message: `Subscribing to Royal ${plan.duration} ${plan.unit}` });

    const result = await purchase(plan.productId);

    if (result.success) {
      setModal({ visible: true, type: 'success', title: 'Welcome to Royal!', message: `You're now a Royal member. Enjoy all premium features!` });
    } else {
      setModal({ visible: true, type: 'error', title: 'Purchase Failed', message: result.error || 'Please try again.' });
    }
  };

  const alreadyRoyal = hasTier('royal');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Close Button - Glass Circle */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <View style={styles.closeBtnGlass}>
          <Ionicons name="close" size={28} color={Colors.white} />
        </View>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header - UNLOCK Label */}
        <Text style={styles.becomeLabel}>{alreadyRoyal ? 'YOU ARE' : 'UNLOCK'}</Text>

        {/* ROYAL Text with Decorative Lines */}
        <View style={styles.eliteRow}>
          <View style={styles.eliteLine} />
          <Text style={styles.eliteText}>ROYAL</Text>
          <View style={styles.eliteLine} />
        </View>

        {alreadyRoyal && (
          <View style={styles.currentBadge}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
            <Text style={styles.currentBadgeText}>Current Plan</Text>
          </View>
        )}

        {/* Feature Carousel */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={styles.carousel}
        >
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureSlide}>
              <View style={styles.featureIconContainer}>
                <Ionicons name={feature.icon} size={52} color={Colors.accent} />
              </View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.desc}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Pagination Dots */}
        <View style={styles.dots}>
          {FEATURES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                featureIndex === index && styles.dotActive
              ]}
            />
          ))}
        </View>

        {/* Plans Section */}
        {!alreadyRoyal && (
          <>
            <View style={styles.plansRow}>
              {PLANS.map((plan, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.planCard,
                    selectedPlan === index && styles.planSelected
                  ]}
                  onPress={() => setSelectedPlan(index)}
                  activeOpacity={0.7}
                >
                  {plan.save && (
                    <View style={styles.saveBadge}>
                      <Text style={styles.saveText}>{plan.save}</Text>
                    </View>
                  )}
                  <Text style={[
                    styles.planDuration,
                    selectedPlan === index && styles.planDurationActive
                  ]}>
                    {plan.duration}
                  </Text>
                  <Text style={[
                    styles.planUnit,
                    selectedPlan === index && styles.planUnitActive
                  ]}>
                    {plan.unit}
                  </Text>
                  <Text style={[
                    styles.planPrice,
                    selectedPlan === index && styles.planPriceActive
                  ]}>
                    {plan.perMonth || plan.price}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Terms Text */}
            <Text style={styles.terms}>
              By tapping "Get" or{' '}
              <Text style={styles.appStoreLink}>Subscribe with App Store</Text>
              {' '}below, you agree to our{' '}
              <Text style={styles.termsLink}>TERMS</Text>, and your subscription will auto-renew
              for the same price and plan length until you cancel via Account Settings.
            </Text>

            {/* Subscribe Button */}
            <View style={styles.btnSection}>
              <Button
                title={`Get ${PLANS[selectedPlan].duration} ${PLANS[selectedPlan].unit} for ${PLANS[selectedPlan].price}`}
                variant="primary"
                size="lg"
                loading={purchaseInProgress}
                onPress={handleSubscribe}
              />
            </View>

            {/* App Store Link */}
            <TouchableOpacity style={styles.appStoreBtn} onPress={handleSubscribe}>
              <Text style={styles.appStoreTextLink}>Subscribe with App Store</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 20,
  },
  becomeLabel: {
    ...Typography.label,
    color: Colors.accent,
    letterSpacing: 3,
    marginBottom: 12,
  },
  eliteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  eliteLine: {
    height: 2,
    flex: 1,
    backgroundColor: Colors.accent,
  },
  eliteText: {
    ...Typography.display,
    fontSize: 40,
    color: Colors.accent,
    letterSpacing: 4,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  currentBadgeText: {
    ...Typography.label,
    color: Colors.accent,
  },
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
    backgroundColor: 'rgba(255, 82, 82, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    ...Typography.h2,
    color: Colors.white,
    marginTop: 8,
    textAlign: 'center',
  },
  featureDesc: {
    ...Typography.bodySmall,
    color: Colors.gray400,
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
    backgroundColor: Colors.gray600,
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  plansRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 20,
  },
  planCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  planSelected: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  saveBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
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
    fontSize: 28,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: Colors.white,
    marginTop: 8,
  },
  planDurationActive: {
    color: Colors.accent,
  },
  planUnit: {
    ...Typography.caption,
    color: Colors.gray400,
    marginTop: 2,
  },
  planUnitActive: {
    color: Colors.gray600,
  },
  planPrice: {
    ...Typography.label,
    color: Colors.gray400,
    marginTop: 10,
  },
  planPriceActive: {
    color: Colors.accent,
  },
  terms: {
    ...Typography.caption,
    color: Colors.gray500,
    textAlign: 'center',
    marginTop: 28,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  appStoreLink: {
    color: Colors.white,
    textDecorationLine: 'underline',
  },
  termsLink: {
    color: Colors.accent,
    fontWeight: '700',
  },
  btnSection: {
    width: '100%',
    marginTop: 24,
  },
  appStoreBtn: {
    marginTop: 18,
  },
  appStoreTextLink: {
    ...Typography.bodySemibold,
    color: Colors.white,
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
