// AnaJunubin — Interactivity Hub (Games, Challenges, Leaderboard)
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import UnderlineTabs from '../components/UnderlineTabs';
import { GraffitiCrown, GraffitiFlame } from '../components/icons';
import { TribalDivider, SpraySplatter } from '../components/GraffitiAccents';
import { GAME_CATALOG } from '../data/games';

import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import * as matchesService from '../api/services/matchesService';
import { mockMatches } from '../data/mockProfiles';
import { imageSource } from '../utils/imageSource';

const TABS = ['Games', 'Challenges', 'Leaderboard'];

const DAILY_CHALLENGE = {
  emoji: '\uD83D\uDD25',
  title: 'Daily Challenge',
  description: 'Play 2 games with different matches today',
  reward: '+50 XP',
};

const WEEKLY_CHALLENGES = [
  { id: 'w1', label: 'Play 3 This or That rounds', done: false },
  { id: 'w2', label: 'Win a Trivia game', done: false },
  { id: 'w3', label: 'Complete a Vibe Check', done: false },
  { id: 'w4', label: 'Challenge 2 different matches', done: false },
  { id: 'w5', label: 'Reach 80%+ vibe match', done: false },
];

const ACHIEVEMENTS = [
  { id: 'a1', emoji: '\u26A1', label: 'Speed Demon', description: '5 games in one day', unlocked: false },
  { id: 'a2', emoji: '\uD83E\uDDE0', label: 'Trivia King', description: 'Score 5/5 in Trivia', unlocked: false },
  { id: 'a3', emoji: '\uD83D\uDD2E', label: 'Soulmate', description: '100% Vibe Check', unlocked: false },
  { id: 'a4', emoji: '\uD83C\uDFC6', label: 'Challenger', description: 'Challenge 10 matches', unlocked: false },
  { id: 'a5', emoji: '\uD83D\uDD25', label: 'On Fire', description: '7-day streak', unlocked: false },
  { id: 'a6', emoji: '\uD83D\uDC51', label: 'Crown', description: 'Top 3 weekly', unlocked: false },
];

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'Ayen D.', score: 2840, emoji: '\uD83E\uDD47' },
  { rank: 2, name: 'Deng M.', score: 2650, emoji: '\uD83E\uDD48' },
  { rank: 3, name: 'Nyabol K.', score: 2480, emoji: '\uD83E\uDD49' },
  { rank: 4, name: 'Garang P.', score: 2100 },
  { rank: 5, name: 'Achol W.', score: 1950 },
  { rank: 6, name: 'Kuol B.', score: 1820 },
  { rank: 7, name: 'Nyandit J.', score: 1700 },
  { rank: 8, name: 'You', score: 1580, isMe: true },
];

export default function InteractivityHubScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark, insets), [colors, isDark, insets]);
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [challengesDone, setChallengesDone] = useState({});
  const streak = Object.values(challengesDone).filter(Boolean).length;
  const { hasTier } = useSubscription();
  const { session } = useAuth();
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    let mounted = true;
    const fallback = mockMatches.map((m) => ({
      id: m.id,
      name: m.name,
      images: m.images,
    }));

    if (!session) {
      setConnections(fallback);
      return () => { mounted = false; };
    }

    matchesService.getMatches().then((items) => {
      if (!mounted) return;
      if (items?.length) {
        setConnections(items.map((m) => ({
          id: m.id,
          name: m.name,
          images: m.images,
        })));
      } else {
        setConnections(fallback);
      }
    }).catch(() => {
      if (mounted) setConnections(fallback);
    });

    return () => { mounted = false; };
  }, [session]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color={colors.black} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <GraffitiFlame size={18} color={colors.accent} filled />
              <Text style={styles.title}>Games & Fun</Text>
            </View>
            <TribalDivider width={80} height={5} colors={['#EF4444', '#22C55E', '#3B82F6']} style={{ marginTop: 1 }} />
          </View>
          <View style={styles.backBtnSpacer} />
        </View>
        <UnderlineTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'Games' && (
          <GamesTab
            styles={styles}
            colors={colors}
            isDark={isDark}
            navigation={navigation}
            hasTier={hasTier}
            connections={connections}
          />
        )}
        {activeTab === 'Challenges' && (
          <ChallengesTab
            styles={styles}
            colors={colors}
            streak={streak}
            challengesDone={challengesDone}
            setChallengesDone={setChallengesDone}
          />
        )}
        {activeTab === 'Leaderboard' && (
          <LeaderboardTab styles={styles} colors={colors} />
        )}
      </ScrollView>
    </View>
  );
}

// ── Games Tab ──
function GamesTab({ styles, colors, isDark, navigation, hasTier, connections }) {
  const requirePlus = (callback) => {
    if (!hasTier('plus')) {
      Alert.alert('JuNubin+ Feature', 'In-chat games require JuNubin+ or higher.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    callback();
  };

  return (
    <>
      {/* Game cards — horizontal scroll */}
      <Text style={styles.sectionLabel}>Play Now</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gamesRow}>
        {GAME_CATALOG.map((game) => (
          <TouchableOpacity
            key={game.type}
            style={styles.gameCard}
            activeOpacity={0.8}
            onPress={() => requirePlus(() => {
              navigation.navigate('Chat', { startGame: true });
            })}
          >
            <LinearGradient
              colors={[game.color, shiftColor(game.color, -30)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gameCardGradient}
            >
              <Text style={styles.gameEmoji}>{game.emoji}</Text>
              <Text style={styles.gameName} numberOfLines={1}>{game.name}</Text>
              <Text style={styles.gameTagline} numberOfLines={2}>{game.tagline}</Text>
              <View style={styles.playPill}>
                <Ionicons name="play" size={11} color="#FFFFFF" />
                <Text style={styles.playPillText}>Play</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Daily Challenge */}
      <Text style={styles.sectionLabel}>Daily Challenge</Text>
      <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: '#FFD700' }]}>
        <View style={styles.cardRow}>
          <Text style={styles.cardEmoji}>{DAILY_CHALLENGE.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{DAILY_CHALLENGE.title}</Text>
            <Text style={styles.cardDesc}>{DAILY_CHALLENGE.description}</Text>
          </View>
          <View style={styles.rewardBadge}>
            <Text style={styles.rewardText}>{DAILY_CHALLENGE.reward}</Text>
          </View>
        </View>
      </View>

      {/* Challenge all connections */}
      <View style={styles.connectionsHeader}>
        <Text style={styles.sectionLabel}>All Connections</Text>
        <Text style={styles.connectionsCount}>{connections.length}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchesRow}>
        {connections.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={styles.matchAvatar}
            activeOpacity={0.75}
            onPress={() => requirePlus(() => navigation.navigate('Chat', { match: { id: m.id, name: m.name, images: m.images }, startGame: true }))}
          >
            <View style={styles.avatarWrap}>
              <Image source={imageSource(m.images?.[0])} style={styles.avatarImage} />
              <View style={styles.challengeDot}>
                <Ionicons name="game-controller" size={10} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.matchName} numberOfLines={1}>{m.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
}

// ── Challenges Tab ──
function ChallengesTab({ styles, colors, streak, challengesDone, setChallengesDone }) {
  return (
    <>
      {/* Weekly streak */}
      <View style={styles.streakCard}>
        <Ionicons name="flame" size={28} color="#F56040" />
        <View style={{ flex: 1 }}>
          <Text style={styles.streakTitle}>{streak} / 5 Weekly Streak</Text>
          <View style={styles.streakBar}>
            <View style={[styles.streakFill, { width: `${(streak / 5) * 100}%`, backgroundColor: colors.accent }]} />
          </View>
        </View>
      </View>

      {/* Challenge checklist */}
      <Text style={styles.sectionLabel}>This Week</Text>
      {WEEKLY_CHALLENGES.map((ch) => (
        <TouchableOpacity
          key={ch.id}
          style={styles.challengeRow}
          onPress={() => setChallengesDone((prev) => ({ ...prev, [ch.id]: !prev[ch.id] }))}
          activeOpacity={0.75}
        >
          <Ionicons
            name={challengesDone[ch.id] ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={challengesDone[ch.id] ? colors.accent : colors.gray400}
          />
          <Text style={[styles.challengeLabel, challengesDone[ch.id] && styles.challengeDone]}>{ch.label}</Text>
        </TouchableOpacity>
      ))}

      {/* Achievements */}
      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Achievements</Text>
      <View style={styles.badgeGrid}>
        {ACHIEVEMENTS.map((a) => (
          <View key={a.id} style={[styles.badge, a.unlocked && styles.badgeUnlocked]}>
            <Text style={styles.badgeEmoji}>{a.emoji}</Text>
            <Text style={[styles.badgeLabel, a.unlocked && styles.badgeLabelUnlocked]}>{a.label}</Text>
            <Text style={styles.badgeDesc}>{a.description}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

// ── Leaderboard Tab ──
function LeaderboardTab({ styles, colors }) {
  const top3 = MOCK_LEADERBOARD.slice(0, 3);
  const rest = MOCK_LEADERBOARD.slice(3);

  return (
    <>
      {/* Podium */}
      <View style={styles.podium}>
        {[top3[1], top3[0], top3[2]].map((entry, i) => {
          const heights = [90, 120, 70];
          const isCenter = i === 1;
          return (
            <View key={entry.rank} style={styles.podiumCol}>
              <Text style={styles.podiumEmoji}>{entry.emoji}</Text>
              <View style={[styles.podiumBar, { height: heights[i], backgroundColor: isCenter ? colors.accent : colors.gray200 }]}>
                <Text style={[styles.podiumName, isCenter && { color: '#FFF' }]}>{entry.name}</Text>
                <Text style={[styles.podiumScore, isCenter && { color: '#FFF' }]}>{entry.score}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Ranked list */}
      {rest.map((entry) => (
        <View key={entry.rank} style={[styles.leaderRow, entry.isMe && styles.leaderRowMe]}>
          <Text style={styles.rankNum}>{entry.rank}</Text>
          <View style={[styles.rankAvatar, { backgroundColor: entry.isMe ? colors.accent : colors.gray200 }]}>
            <Text style={[styles.rankInitial, entry.isMe && { color: '#FFF' }]}>{entry.name.charAt(0)}</Text>
          </View>
          <Text style={[styles.rankName, entry.isMe && { fontFamily: FontFamily.bold }]}>{entry.name}</Text>
          <Text style={styles.rankScore}>{entry.score} XP</Text>
        </View>
      ))}
    </>
  );
}

function shiftColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const getStyles = (colors, isDark, insets) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gray200,
  },
  title: {
    fontSize: 34,
    fontFamily: FontFamily.script,
    color: colors.black,
    letterSpacing: 0.3,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    marginBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  backBtnSpacer: {
    width: 36,
    height: 36,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: insets.bottom + 28,
    gap: 12,
  },
  sectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: colors.gray400,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  // ── Games Tab ──
  gamesRow: { gap: 12, paddingVertical: 4, paddingRight: 12 },
  gameCard: { width: 166, height: 200, borderRadius: 20, overflow: 'hidden' },
  gameCardGradient: {
    flex: 1,
    padding: 18,
    alignItems: 'flex-start',
    gap: 6,
    justifyContent: 'space-between',
  },
  gameEmoji: { fontSize: 34 },
  gameName: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  gameTagline: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.86)',
    textAlign: 'left',
  },
  playPill: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Daily challenge card
  card: {
    backgroundColor: isDark ? colors.cardBg : colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 0.5,
    borderColor: colors.gray200,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardEmoji: { fontSize: 28 },
  cardTitle: { ...Typography.bodySemibold, color: colors.black, fontSize: 15 },
  cardDesc: { ...Typography.caption, color: colors.gray400, marginTop: 2 },
  rewardBadge: {
    backgroundColor: '#FFD70020',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  rewardText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#B8860B',
  },

  // Connections rail
  connectionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connectionsCount: {
    ...Typography.captionBold,
    color: colors.accent,
    backgroundColor: colors.accentTint10,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  matchesRow: { gap: 16, paddingVertical: 4 },
  matchAvatar: { alignItems: 'center', gap: 6 },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2.5,
    borderColor: colors.accent,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.gray300,
  },
  challengeDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchName: {
    ...Typography.caption,
    color: colors.black,
    maxWidth: 72,
    textAlign: 'center',
  },

  // ── Challenges Tab ──
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: isDark ? colors.cardBg : colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: colors.gray200,
  },
  streakTitle: {
    ...Typography.bodySemibold,
    color: colors.black,
    fontSize: 15,
    marginBottom: 8,
  },
  streakBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray200,
    overflow: 'hidden',
  },
  streakFill: {
    height: '100%',
    borderRadius: 4,
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gray200,
  },
  challengeLabel: {
    ...Typography.bodySmall,
    color: colors.black,
    flex: 1,
  },
  challengeDone: {
    textDecorationLine: 'line-through',
    color: colors.gray400,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badge: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.white,
    gap: 4,
  },
  badgeUnlocked: {
    borderColor: colors.accent,
    backgroundColor: isDark ? colors.accentTint10 : colors.accentTint06,
  },
  badgeEmoji: { fontSize: 24 },
  badgeLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: colors.gray400,
    textAlign: 'center',
  },
  badgeLabelUnlocked: { color: colors.accent },
  badgeDesc: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: colors.gray400,
    textAlign: 'center',
  },

  // ── Leaderboard Tab ──
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 12,
    marginVertical: 12,
  },
  podiumCol: { alignItems: 'center', gap: 6, width: 90 },
  podiumEmoji: { fontSize: 24 },
  podiumBar: {
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
  },
  podiumName: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: colors.black,
  },
  podiumScore: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    color: colors.gray600,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gray200,
  },
  leaderRowMe: {
    backgroundColor: isDark ? colors.accentTint10 : colors.accentTint06,
    borderRadius: 12,
    borderBottomWidth: 0,
  },
  rankNum: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: colors.gray400,
    width: 22,
    textAlign: 'center',
  },
  rankAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankInitial: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: colors.black,
  },
  rankName: {
    ...Typography.bodySmall,
    color: colors.black,
    flex: 1,
  },
  rankScore: {
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    color: colors.gray400,
  },
});
