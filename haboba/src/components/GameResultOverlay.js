// AnaJunubin — Game Result Overlay (follows MatchCelebrationOverlay pattern)
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, useTheme } from '../theme';
import { GraffitiSparkles, GraffitiStar, GraffitiFlame } from './icons';
import { hapticHeavy } from '../utils/haptics';
import { GAME_TYPES } from '../data/games';
import { computeResult } from '../utils/gameEngine';

const { width: SCREEN_W } = Dimensions.get('window');

const BURST_VECTORS = [
  { x: 0, y: -50 }, { x: 35, y: -35 }, { x: 50, y: 0 }, { x: 35, y: 35 },
  { x: 0, y: 50 }, { x: -35, y: 35 }, { x: -50, y: 0 }, { x: -35, y: -35 },
  { x: 18, y: -25 }, { x: 25, y: -8 }, { x: 25, y: 8 }, { x: 18, y: 25 },
];

const PARTICLE_COMPONENTS = [GraffitiSparkles, GraffitiStar, GraffitiFlame];
const PARTICLE_COLORS = ['#FFD700', '#F56040', '#ED4956', '#7C4DFF'];

const GameResultOverlay = ({ visible, session, matchName, onPlayAgain, onClose }) => {
  const { colors } = useTheme();
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const burstAnims = useRef(BURST_VECTORS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (visible && session) {
      hapticHeavy();
      overlayOpacity.setValue(0);
      emojiScale.setValue(0);
      resultOpacity.setValue(0);
      buttonsOpacity.setValue(0);
      burstAnims.forEach((a) => a.setValue(0));

      Animated.sequence([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.parallel([
          Animated.spring(emojiScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
          ...burstAnims.map((anim, i) =>
            Animated.timing(anim, { toValue: 1, duration: 1200, delay: i * 40, useNativeDriver: true })
          ),
        ]),
        Animated.timing(resultOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(buttonsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, session, overlayOpacity, emojiScale, resultOpacity, buttonsOpacity, burstAnims]);

  if (!visible || !session) return null;

  const result = computeResult(session);
  const isTrivia = session.type === GAME_TYPES.trivia;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
      {/* Particle burst */}
      <View style={styles.burstContainer}>
        {BURST_VECTORS.map((vec, i) => {
          const anim = burstAnims[i];
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.burstParticle,
                {
                  opacity: anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                  transform: [
                    { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, vec.x] }) },
                    { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, vec.y] }) },
                    { scale: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1.2, 0.6] }) },
                  ],
                },
              ]}
            >
              {React.createElement(PARTICLE_COMPONENTS[i % PARTICLE_COMPONENTS.length], {
                size: i < 8 ? 16 : 12,
                color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                filled: true,
              })}
            </Animated.View>
          );
        })}
      </View>

      {/* Emoji + game name */}
      <Animated.View style={{ transform: [{ scale: emojiScale }], alignItems: 'center' }}>
        <Text style={styles.emoji}>{session.emoji}</Text>
        <Text style={styles.gameName}>{session.name}</Text>
      </Animated.View>

      {/* Result */}
      <Animated.View style={[styles.resultWrap, { opacity: resultOpacity }]}>
        {isTrivia ? (
          <>
            <View style={styles.triviaScores}>
              <View style={styles.scoreColumn}>
                <Text style={styles.playerLabel}>You</Text>
                <Text style={[styles.bigScore, result.winner === 'me' && { color: '#FFD700' }]}>
                  {result.myScore}
                </Text>
                {result.winner === 'me' && <Ionicons name="trophy" size={20} color="#FFD700" />}
              </View>
              <Text style={styles.divider}>vs</Text>
              <View style={styles.scoreColumn}>
                <Text style={styles.playerLabel}>{matchName || 'Them'}</Text>
                <Text style={[styles.bigScore, result.winner === 'them' && { color: '#FFD700' }]}>
                  {result.theirScore}
                </Text>
                {result.winner === 'them' && <Ionicons name="trophy" size={20} color="#FFD700" />}
              </View>
            </View>
            <Text style={styles.outOf}>out of {result.total}</Text>
          </>
        ) : (
          <>
            <Text style={styles.vibePercent}>{result.matchPercent}%</Text>
            <Text style={styles.vibeLabel}>Vibe Match</Text>
          </>
        )}
      </Animated.View>

      {/* Buttons */}
      <Animated.View style={[styles.buttonsWrap, { opacity: buttonsOpacity }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: session.color }]}
          onPress={onPlayAgain}
          activeOpacity={0.85}
        >
          <Ionicons name="refresh" size={18} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.primaryBtnText}>Play Again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostBtn} onPress={onClose} activeOpacity={0.7}>
          <Text style={styles.ghostBtnText}>Close</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  burstContainer: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
    width: 1,
    height: 1,
  },
  burstParticle: { position: 'absolute' },
  emoji: { fontSize: 56, marginBottom: 8 },
  gameName: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: '#FFFFFF',
    marginBottom: 24,
  },
  resultWrap: { alignItems: 'center', marginBottom: 10 },
  triviaScores: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  scoreColumn: { alignItems: 'center', gap: 4 },
  playerLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  bigScore: {
    fontFamily: FontFamily.extrabold,
    fontSize: 40,
    color: '#FFFFFF',
  },
  divider: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
  },
  outOf: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },
  vibePercent: {
    fontFamily: FontFamily.extrabold,
    fontSize: 56,
    color: '#FFFFFF',
  },
  vibeLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  buttonsWrap: {
    marginTop: 40,
    width: '100%',
    paddingHorizontal: 40,
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  ghostBtn: {
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  ghostBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
});

export default React.memo(GameResultOverlay);
