import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';

const { width, height } = Dimensions.get('window');

const LANDING_IMAGE = require('../assets/landing.jpeg');

const OnboardingScreen = ({ navigation }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const pages = [
    {
      id: 1,
      title: 'Find Your\nPerson',
      description:
        'Meet South Sudanese singles who get you — your values, your vibe, your story.',
    },
    {
      id: 2,
      title: 'Made for\nJunub',
      description:
        'One people, one heartbeat. Whether you\'re in Juba or across the world — this is where our stories meet.',
    },
  ];

  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);
    setCurrentPage(currentIndex);
  };

  const handleGetStarted = () => {
    navigation.navigate('Signup');
  };

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      scrollViewRef.current?.scrollTo({
        x: width * (currentPage + 1),
        animated: true,
      });
    }
  };

  return (
    <ImageBackground
      source={LANDING_IMAGE}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      {/* Dark gradient overlay */}
      <View style={styles.overlay} />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View />
          {currentPage < pages.length - 1 && (
            <TouchableOpacity onPress={() => navigation.replace('Main')}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Carousel */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          scrollEventThrottle={16}
          onScroll={handleScroll}
          showsHorizontalScrollIndicator={false}
          style={styles.carouselContainer}
        >
          {pages.map((page) => (
            <View key={page.id} style={styles.page}>
              {/* Content */}
              <View style={styles.contentSection}>
                <Text style={styles.pageTitle}>{page.title}</Text>
                <Text style={styles.pageDescription}>{page.description}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Bottom Section */}
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
          {/* Pagination Dots */}
          <View style={styles.dotsContainer}>
            {pages.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, currentPage === index && styles.dotActive]}
              />
            ))}
          </View>

          {currentPage === pages.length - 1 ? (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={handleGetStarted}>
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('Signup')}
              >
                <Ionicons name="phone-portrait-outline" size={18} color="#FFFFFF" />
                <Text style={styles.secondaryButtonText}>Continue with Phone</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('Signup')}
              >
                <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
                <Text style={styles.secondaryButtonText}>Continue with Email</Text>
              </TouchableOpacity>

              <Text style={styles.termsText}>
                By continuing, you agree to our{' '}
                <Text style={styles.termsLink}>Terms</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </>
          ) : (
            <TouchableOpacity style={styles.nextCircle} onPress={handleNext}>
              <Ionicons name="arrow-forward" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ImageBackground>
  );
};

const getStyles = (colors) => StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 22, 18, 0.65)',
  },
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  skipText: {
    ...Typography.label,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  carouselContainer: {
    flex: 1,
  },
  page: {
    width,
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 48,
  },
  contentSection: {
    paddingHorizontal: 32,
  },
  pageTitle: {
    fontSize: 42,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: '#FFFFFF',
    marginBottom: 14,
    letterSpacing: -0.5,
    lineHeight: 48,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  pageDescription: {
    ...Typography.body,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomSection: {
    paddingHorizontal: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 82, 82, 0.25)',
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 28,
    borderRadius: 4,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 28,
    marginBottom: 12,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 28,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: '#FFFFFF',
  },
  nextCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  termsText: {
    ...Typography.caption,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.accent,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
});

export default OnboardingScreen;
