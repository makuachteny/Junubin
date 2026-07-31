// JuNubin — Social action row
//
// Repurposed from the old swipe-deck row (Rewind · Pass · Super Like ·
// Like · Whisper). The deck is gone with the dating model, and with it
// every one of those five actions. What's left is the row a community
// platform actually needs, and it's now a reusable control any
// person-surface can drop in:
//
//     Follow / Following   ·   Message   ·   More
//
// Props:
//   onFollow()     — toggle the follow edge. Required for the button
//                    to render as interactive.
//   onMessage()    — open the thread, or the message-request composer
//                    when `canMessage` is false (the caller decides).
//   onMore()       — overflow; this is where Block / Report live.
//   isFollowing    — follow edge exists, one-directionally
//   isConnected    — mutual follow; wins over isFollowing for the label
//   canMessage     — direct messaging allowed. Only changes the label
//                    ("Message" vs "Request"), never hides the button.
//   requested      — an outgoing message request is already pending
//   loading        — disables Follow while a toggle is in flight
//
// The row is designed to sit over a photo (translucent fills, shadows)
// but reads fine on a solid background too.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily } from '../theme';
import { hapticLight } from '../utils/haptics';

const ActionButtons = ({
  onFollow,
  onMessage,
  onMore,
  isFollowing = false,
  isConnected = false,
  canMessage = false,
  requested = false,
  loading = false,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const followLabel = isConnected ? 'Connected' : isFollowing ? 'Following' : 'Follow';
  const followIcon = isConnected ? 'people' : isFollowing ? 'checkmark' : 'person-add';
  const followOn = isConnected || isFollowing;

  const messageLabel = canMessage ? 'Message' : requested ? 'Requested' : 'Message';

  return (
    <View style={styles.container}>
      <View style={styles.item}>
        <TouchableOpacity
          style={[styles.btn, styles.followBtn, followOn && styles.followBtnOn]}
          onPress={() => { hapticLight(); onFollow?.(); }}
          disabled={loading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityState={{ selected: followOn, disabled: loading }}
          accessibilityLabel={
            isConnected ? 'Connected, tap to unfollow'
            : isFollowing ? 'Following, tap to unfollow'
            : 'Follow'
          }
        >
          <Ionicons name={followIcon} size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.label}>{followLabel}</Text>
      </View>

      <View style={styles.item}>
        <TouchableOpacity
          style={[styles.btn, styles.messageBtn]}
          onPress={() => { hapticLight(); onMessage?.(); }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={canMessage ? 'Send a message' : 'Send a message request'}
        >
          <Ionicons name="chatbubble" size={21} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.label}>{messageLabel}</Text>
      </View>

      <View style={styles.item}>
        <TouchableOpacity
          style={[styles.btn, styles.moreBtn]}
          onPress={() => { hapticLight(); onMore?.(); }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="More options, including block and report"
        >
          <Ionicons name="ellipsis-horizontal" size={21} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.label}>More</Text>
      </View>
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 22,
  },
  // Fixed-width items keep the three captions on one baseline even
  // when they're different lengths ("Connected" vs "More").
  item: {
    alignItems: 'center',
    gap: 6,
    width: 68,
  },
  btn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  followBtn: {
    backgroundColor: colors.accent,
  },
  followBtnOn: {
    backgroundColor: '#6A6A6A',
  },
  // Flag yellow — the primary "start talking" action.
  messageBtn: {
    backgroundColor: '#FCCD12',
  },
  moreBtn: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  label: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontFamily: FontFamily.semibold,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 4,
  },
});

export default React.memo(ActionButtons);
