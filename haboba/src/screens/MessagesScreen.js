import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import { mockMatches, mockLikes, currentUser, imageSource } from '../data/mockProfiles';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import * as matchesService from '../api/services/matchesService';

export default function MessagesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [matches, setMatches] = useState(mockMatches);
  const [likes, setLikes] = useState(mockLikes);
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { hasTier } = useSubscription();
  const { accessToken } = useAuth();
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!accessToken) return;
    matchesService.getMatches(accessToken).then((apiMatches) => {
      if (apiMatches.length > 0) setMatches(apiMatches);
    }).catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [contentAnim]);

  const handleMatchPress = (match) => {
    navigation.navigate('Chat', { match });
  };

  const handleLikePress = (like) => {
    if (!hasTier('royal')) {
      Alert.alert('Royal Feature', 'Upgrade to Royal to message people who liked you.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    navigation.navigate('Chat', { match: like });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: contentAnim,
            transform: [
              {
                translateY: contentAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-8, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerSettingsBtn}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.75}
        >
          <Ionicons name="options-outline" size={18} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AnaJunubin</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
          <Image source={imageSource(currentUser.images[0])} style={styles.headerAvatar} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        style={[
          styles.content,
          {
            opacity: contentAnim,
            transform: [
              {
                translateY: contentAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* New Connections */}
        <Text style={styles.sectionTitle}>New Connections</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.connectionsRow}>
          {/* Like circle */}
          <TouchableOpacity style={styles.likeCircle} onPress={() => navigation.navigate('LikesTab')}>
            <View style={styles.likeCircleInner}>
              <Text style={styles.likeCount}>{likes.length}</Text>
            </View>
            <Ionicons
              name="heart"
              size={14}
              color={colors.accent}
              style={styles.likeHeartIcon}
            />
            <Text style={styles.likeLabel}>Like</Text>
          </TouchableOpacity>

          {/* Match avatars */}
          {matches.map((match) => (
            <TouchableOpacity
              key={match.id}
              style={styles.matchCircle}
              onPress={() => handleMatchPress(match)}
            >
              <Image source={imageSource(match.images[0])} style={styles.matchAvatar} />
              {match.unread && <View style={styles.onlineDot} />}
              <Text style={styles.matchName} numberOfLines={1}>
                {match.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.connectionHint}>Slide right to get new connections!</Text>

        {/* Messages */}
        <Text style={styles.sectionTitle}>Messages</Text>
        {matches.length === 0 && likes.length === 0 ? (
          <View style={styles.emptyMessages}>
            <Ionicons name="chatbubbles-outline" size={50} color={colors.gray400} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>
              Start swiping to find connections!
            </Text>
          </View>
        ) : (
          <>
            {likes.map((like) => (
              <TouchableOpacity
                key={like.id}
                style={styles.messageRow}
                onPress={() => handleLikePress(like)}
                activeOpacity={0.7}
              >
                <View style={styles.avatarContainer}>
                  <Image source={imageSource(like.images[0])} style={styles.msgAvatar} />
                </View>
                <View style={styles.msgInfo}>
                  <View style={styles.msgNameInline}>
                    <Text style={styles.msgName}>{like.name}</Text>
                    <View style={styles.likesYouBadge}>
                      <Text style={styles.likesYouText}>Likes You</Text>
                    </View>
                  </View>
                  <Text style={styles.msgPreview}>Liked you recently, match now!</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
              </TouchableOpacity>
            ))}
            {matches.map((match) => (
              <TouchableOpacity
                key={match.id}
                style={styles.messageRow}
                onPress={() => handleMatchPress(match)}
                activeOpacity={0.7}
              >
                <View style={styles.avatarContainer}>
                  <Image source={imageSource(match.images[0])} style={styles.msgAvatar} />
                  {match.unread && <View style={styles.unreadDot} />}
                </View>
                <View style={styles.msgInfo}>
                  <View style={styles.msgNameRow}>
                    <Text style={styles.msgName}>{match.name}</Text>
                    <Text style={styles.msgTime}>{match.timestamp}</Text>
                  </View>
                  <Text style={[styles.msgPreview, match.unread && styles.msgUnread]}>
                    {match.lastMessage}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
              </TouchableOpacity>
            ))}
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    width: '100%',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: colors.white,
  },
  headerSettingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.separator,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    ...getShadow('md', isDark),
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FontFamily.script,
    color: colors.black,
    textAlign: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.gray300,
    ...getShadow('md', isDark),
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
    color: colors.black,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  connectionsRow: {
    paddingLeft: 16,
    paddingRight: 8,
    paddingBottom: 8,
  },
  likeCircle: {
    alignItems: 'center',
    marginRight: 20,
  },
  likeCircleInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    ...getShadow('md', isDark),
  },
  likeCount: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.accent,
    letterSpacing: -0.5,
  },
  likeHeartIcon: {
    position: 'absolute',
    bottom: 16,
    left: -2,
  },
  likeLabel: {
    ...Typography.caption,
    color: colors.black,
    marginTop: 6,
  },
  matchCircle: {
    alignItems: 'center',
    marginRight: 20,
    position: 'relative',
  },
  matchAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.gray300,
    borderWidth: 2,
    borderColor: colors.accent,
    ...getShadow('md', isDark),
  },
  onlineDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: colors.white,
  },
  matchName: {
    ...Typography.caption,
    color: colors.black,
    marginTop: 6,
    maxWidth: 68,
    textAlign: 'center',
  },
  connectionHint: {
    ...Typography.label,
    color: colors.gray500,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    fontWeight: '400',
    fontFamily: FontFamily.regular,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  msgAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gray300,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    position: 'absolute',
    bottom: -4,
    right: -4,
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  msgInfo: {
    flex: 1,
  },
  msgNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  msgNameInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  msgName: {
    ...Typography.sectionLabel,
    color: colors.black,
    flex: 1,
  },
  msgTime: {
    ...Typography.caption,
    color: colors.gray500,
    marginLeft: 8,
  },
  msgPreview: {
    ...Typography.bodySmall,
    color: colors.gray600,
    marginTop: 2,
    lineHeight: 18,
  },
  msgUnread: {
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },
  likesYouBadge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  likesYouText: {
    ...Typography.captionBold,
    color: '#FFFFFF',
    fontSize: 11,
    letterSpacing: 0.3,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  emptyMessages: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    ...Typography.h4,
    color: colors.black,
    marginTop: 16,
  },
  emptySubtext: {
    ...Typography.bodySmall,
    color: colors.gray500,
    marginTop: 8,
  },
});
