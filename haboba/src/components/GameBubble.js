// AnaJunubin — Game Chat Bubble (follows GiftBubble pattern)
// Visual states: playing → waiting → revealed → complete | timed_out

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { FontFamily } from '../theme';
import { GAME_TYPES } from '../data/games';
import { computeResult } from '../utils/gameEngine';

const GRACE_PERIOD_MS = 3000;

// ── Animated waiting dot (follows OnlinePulseDot pattern) ──
function WaitingDot({ color, delay = 0 }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[styles.waitDot, { backgroundColor: color }, animStyle]}
    />
  );
}

// ── Trivia reveal pill with color transition ──
function TriviaRevealPill({ opt, isCorrect, iMine, isTheirs, matchName, textColor }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });
  }, []);

  const animStyle = useAnimatedStyle(() => {
    const bgColor = isCorrect
      ? interpolateColor(progress.value, [0, 1], ['rgba(0,0,0,0.03)', 'rgba(76,175,80,0.12)'])
      : (iMine || isTheirs)
        ? interpolateColor(progress.value, [0, 1], ['rgba(0,0,0,0.03)', 'rgba(244,67,54,0.12)'])
        : 'rgba(0,0,0,0.03)';
    const borderClr = isCorrect
      ? interpolateColor(progress.value, [0, 1], ['rgba(0,0,0,0.08)', '#4CAF50'])
      : (iMine || isTheirs)
        ? interpolateColor(progress.value, [0, 1], ['rgba(0,0,0,0.08)', '#F44336'])
        : 'rgba(0,0,0,0.08)';
    return { backgroundColor: bgColor, borderColor: borderClr };
  });

  return (
    <Animated.View style={[styles.revealPill, animStyle]}>
      <Text style={[styles.revealPillText, { color: textColor }]}>{opt}</Text>
      {iMine && <Text style={styles.answerTag}>You</Text>}
      {isTheirs && <Text style={styles.answerTag}>{matchName || 'Them'}</Text>}
    </Animated.View>
  );
}

export default function GameBubble({
  session,
  isMe,
  time,
  matchName,
  onAnswer,
  onPlayAgain,
  colors,
}) {
  const { type, round, totalRounds, questions, myAnswers, theirAnswers, status, emoji, name, color } = session;
  const question = questions?.[round];
  const myAnswer = myAnswers[round];
  const theirAnswer = theirAnswers[round];

  // ── Grace period state ──
  const [pendingAnswer, setPendingAnswer] = useState(null);
  const graceTimerRef = useRef(null);

  const handleAnswer = useCallback((ans) => {
    setPendingAnswer(ans);
    // Clear any existing grace timer
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    // Start new grace timer
    graceTimerRef.current = setTimeout(() => {
      onAnswer?.(ans);
      graceTimerRef.current = null;
    }, GRACE_PERIOD_MS);
  }, [onAnswer]);

  // Cleanup grace timer on unmount
  useEffect(() => {
    return () => {
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    };
  }, []);

  // Guard against undefined question (corrupted session or out-of-bounds round)
  if (!question && status !== 'complete' && status !== 'timed_out') return null;

  // ── Complete state — summary card ──
  if (status === 'complete') {
    const result = computeResult(session);
    const isTrivia = type === GAME_TYPES.trivia;

    return (
      <View style={[styles.container, isMe ? styles.me : styles.them]}>
        <LinearGradient
          colors={[color, shiftColor(color, -20)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}
        >
          <Text style={styles.completeEmoji}>{emoji}</Text>
          <Text style={styles.completeTitle}>{name} Complete!</Text>
          {isTrivia ? (
            <View style={styles.scoreRow}>
              <View style={styles.scoreBox}>
                <Text style={styles.scoreLabel}>You</Text>
                <Text style={styles.scoreValue}>{result.myScore}/{result.total}</Text>
              </View>
              <Text style={styles.vsText}>vs</Text>
              <View style={styles.scoreBox}>
                <Text style={styles.scoreLabel}>{matchName || 'Them'}</Text>
                <Text style={styles.scoreValue}>{result.theirScore}/{result.total}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.matchPercent}>{result.matchPercent}% match</Text>
          )}
          {onPlayAgain && (
            <TouchableOpacity style={styles.playAgainPill} onPress={onPlayAgain} activeOpacity={0.8}>
              <Text style={styles.playAgainText}>Play Again</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
        <Text style={[styles.time, { color: colors.gray400, textAlign: isMe ? 'right' : 'left' }]}>{time}</Text>
      </View>
    );
  }

  // ── Timed-out state ──
  if (status === 'timed_out') {
    return (
      <View style={[styles.container, isMe ? styles.me : styles.them]}>
        <View style={[styles.cardBubble, styles.timedOutCard, { borderColor: '#F4433640', backgroundColor: '#FFF5F5' }]}>
          <View style={[styles.roundBadge, { backgroundColor: '#F4433615' }]}>
            <Text style={[styles.roundText, { color: '#F44336' }]}>{emoji} Timed Out</Text>
          </View>
          <Text style={[styles.timedOutText, { color: '#A80D1E' }]}>
            Partner didn't respond in time
          </Text>
          {onPlayAgain && (
            <TouchableOpacity
              style={[styles.playAgainPillSmall, { backgroundColor: color }]}
              onPress={onPlayAgain}
              activeOpacity={0.8}
            >
              <Text style={styles.playAgainText}>Play Again</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.time, { color: colors.gray400, textAlign: isMe ? 'right' : 'left' }]}>{time}</Text>
      </View>
    );
  }

  // ── Revealed state — both answers shown ──
  if (status === 'revealed' && myAnswer !== undefined && theirAnswer !== undefined) {
    const isTrivia = type === GAME_TYPES.trivia;
    const matched = myAnswer === theirAnswer;

    return (
      <View style={[styles.container, isMe ? styles.me : styles.them]}>
        <View style={[styles.cardBubble, { borderColor: color + '40', backgroundColor: colors.white }]}>
          <View style={[styles.roundBadge, { backgroundColor: color + '15' }]}>
            <Text style={[styles.roundText, { color }]}>{emoji} {round + 1}/{totalRounds}</Text>
          </View>
          <Text style={[styles.questionText, { color: colors.black }]}>
            {isTrivia ? question.question : (question.question || `${question.optionA} or ${question.optionB}?`)}
          </Text>

          {isTrivia ? (
            <View style={styles.answersCol}>
              {question.options.map((opt, idx) => (
                <TriviaRevealPill
                  key={idx}
                  opt={opt}
                  isCorrect={idx === question.correctIndex}
                  iMine={idx === myAnswer}
                  isTheirs={idx === theirAnswer}
                  matchName={matchName}
                  textColor={colors.black}
                />
              ))}
            </View>
          ) : (
            <View style={styles.revealCol}>
              <View style={[styles.revealOption, myAnswer === 'A' && theirAnswer === 'A' && styles.revealMatch]}>
                <Text style={[styles.revealOptionText, { color: colors.black }]}>{question.optionA}</Text>
                <View style={styles.answerTagRow}>
                  {myAnswer === 'A' && <Text style={styles.answerTag}>You</Text>}
                  {theirAnswer === 'A' && <Text style={styles.answerTag}>{matchName || 'Them'}</Text>}
                </View>
              </View>
              <View style={[styles.revealOption, myAnswer === 'B' && theirAnswer === 'B' && styles.revealMatch]}>
                <Text style={[styles.revealOptionText, { color: colors.black }]}>{question.optionB}</Text>
                <View style={styles.answerTagRow}>
                  {myAnswer === 'B' && <Text style={styles.answerTag}>You</Text>}
                  {theirAnswer === 'B' && <Text style={styles.answerTag}>{matchName || 'Them'}</Text>}
                </View>
              </View>
            </View>
          )}

          {!isTrivia && (
            <View style={[styles.matchIndicator, { backgroundColor: matched ? '#4CAF5020' : '#FF980020' }]}>
              <Ionicons name={matched ? 'checkmark-circle' : 'close-circle'} size={16} color={matched ? '#4CAF50' : '#FF9800'} />
              <Text style={{ color: matched ? '#4CAF50' : '#FF9800', fontSize: 12, fontWeight: '600', fontFamily: FontFamily.semibold }}>{matched ? 'Match!' : 'Different vibes'}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.time, { color: colors.gray400, textAlign: isMe ? 'right' : 'left' }]}>{time}</Text>
      </View>
    );
  }

  // ── Waiting state (I answered, waiting for them) ──
  if (status === 'waiting' && myAnswer !== undefined) {
    return (
      <View style={[styles.container, isMe ? styles.me : styles.them]}>
        <View style={[styles.cardBubble, { borderColor: color + '40', backgroundColor: colors.white }]}>
          <View style={[styles.roundBadge, { backgroundColor: color + '15' }]}>
            <Text style={[styles.roundText, { color }]}>{emoji} {round + 1}/{totalRounds}</Text>
          </View>
          <Text style={[styles.questionText, { color: colors.black }]}>
            {type === GAME_TYPES.trivia ? question.question : (question.question || `${question.optionA} or ${question.optionB}?`)}
          </Text>
          <View style={[styles.waitingBox, { backgroundColor: color + '10' }]}>
            <Text style={[styles.waitingText, { color }]}>Waiting for {matchName || 'them'}...</Text>
            <View style={styles.dotsRow}>
              <WaitingDot color={color} delay={0} />
              <WaitingDot color={color} delay={200} />
              <WaitingDot color={color} delay={400} />
            </View>
          </View>
        </View>
        <Text style={[styles.time, { color: colors.gray400, textAlign: isMe ? 'right' : 'left' }]}>{time}</Text>
      </View>
    );
  }

  // ── Playing state — show question + answer options with grace period ──
  const isTrivia = type === GAME_TYPES.trivia;
  const hasPending = pendingAnswer !== null;
  const disabled = myAnswer !== undefined;

  return (
    <View style={[styles.container, isMe ? styles.me : styles.them]}>
      <View style={[styles.cardBubble, { borderColor: color + '40', backgroundColor: colors.white }]}>
        <View style={[styles.roundBadge, { backgroundColor: color + '15' }]}>
          <Text style={[styles.roundText, { color }]}>{emoji} {round + 1}/{totalRounds}</Text>
        </View>
        <Text style={[styles.questionText, { color: colors.black }]}>
          {isTrivia ? question.question : (question.question || `${question.optionA} or ${question.optionB}?`)}
        </Text>

        {isTrivia ? (
          <View style={[styles.answersCol, disabled && { opacity: 0.6 }]}>
            {question.options.map((opt, idx) => {
              const isSelected = pendingAnswer === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.optionPill,
                    { borderColor: color + '40' },
                    isSelected && { backgroundColor: color + '15', borderColor: color },
                  ]}
                  onPress={() => handleAnswer(idx)}
                  activeOpacity={0.75}
                  disabled={disabled}
                >
                  <Text style={[styles.optionText, { color: colors.black }]}>{opt}</Text>
                  {isSelected && <Text style={[styles.sendingLabel, { color }]}>Sending...</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={[styles.binaryRow, disabled && { opacity: 0.6 }]}>
            <TouchableOpacity
              style={[
                styles.binaryPill,
                { borderColor: color },
                pendingAnswer === 'A' && { backgroundColor: color + '15' },
              ]}
              onPress={() => handleAnswer('A')}
              activeOpacity={0.75}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${question.optionA}`}
            >
              <Text style={[styles.binaryText, { color }]}>{question.optionA}</Text>
              {pendingAnswer === 'A' && <Text style={[styles.sendingLabel, { color }]}>Sending...</Text>}
            </TouchableOpacity>
            <Text style={[styles.orText, { color: colors.gray400 }]}>or</Text>
            <TouchableOpacity
              style={[
                styles.binaryPill,
                { borderColor: color },
                pendingAnswer === 'B' && { backgroundColor: color + '15' },
              ]}
              onPress={() => handleAnswer('B')}
              activeOpacity={0.75}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${question.optionB}`}
            >
              <Text style={[styles.binaryText, { color }]}>{question.optionB}</Text>
              {pendingAnswer === 'B' && <Text style={[styles.sendingLabel, { color }]}>Sending...</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
      <Text style={[styles.time, { color: colors.gray400, textAlign: isMe ? 'right' : 'left' }]}>{time}</Text>
    </View>
  );
}

function shiftColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const styles = StyleSheet.create({
  container: { maxWidth: '85%', minWidth: '65%', marginVertical: 4 },
  me: { alignSelf: 'flex-end' },
  them: { alignSelf: 'flex-start' },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
  },
  myBubble: { borderBottomRightRadius: 4 },
  theirBubble: { borderBottomLeftRadius: 4 },
  cardBubble: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  timedOutCard: {
    borderStyle: 'dashed',
  },
  roundBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  roundText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    lineHeight: 21,
  },
  timedOutText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Binary options (this_or_that, vibe_check, would_you_rather)
  binaryRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  binaryPill: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  binaryText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  orText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
  // Trivia options
  answersCol: {
    gap: 6,
  },
  optionPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
  },
  sendingLabel: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    marginTop: 2,
  },
  // Waiting state
  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  waitingText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  dotsRow: { flexDirection: 'row', gap: 3 },
  waitDot: { width: 5, height: 5, borderRadius: 2.5 },
  // Revealed state
  revealCol: { gap: 8 },
  revealOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  answerTagRow: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  revealMatch: {
    backgroundColor: 'rgba(76,175,80,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.3)',
  },
  revealOptionText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    flex: 1,
  },
  revealPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  revealPillText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    flex: 1,
  },
  answerTag: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  // Complete state
  completeEmoji: { fontSize: 36 },
  completeTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  scoreBox: { alignItems: 'center', gap: 2 },
  scoreLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: FontFamily.medium,
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: FontFamily.extrabold,
  },
  vsText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  matchPercent: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: FontFamily.extrabold,
    marginTop: 2,
  },
  playAgainPill: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  playAgainPillSmall: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  playAgainText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  time: { fontSize: 11, marginTop: 3, paddingHorizontal: 4 },
});
