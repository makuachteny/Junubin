import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography } from '../theme';
import { mockMessages, imageSource } from '../data/mockProfiles';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import * as chatService from '../api/services/chatService';
import { useRealtime } from '../api/hooks/useRealtime';

export default function ChatScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { hasTier } = useSubscription();
  const { session, user: currentUser } = useAuth();

  const match = route.params?.match || {};
  const matchId = match.id || 'match1';
  const conversationId = match.conversationId;
  const initialMessages = mockMessages[matchId] || [];

  const [messages, setMessages] = useState(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef(null);
  const sentIdsRef = useRef(new Set());

  const { onMessage, onTypingStart, onTypingStop } = useRealtime(currentUser?.id);

  // Load message history from API
  useEffect(() => {
    if (!session || !conversationId) return;
    chatService.getMessages(conversationId).then((apiMsgs) => {
      if (apiMsgs.length > 0) {
        setMessages(apiMsgs.map((m) => ({
          id: m.id,
          sender: m.senderId === currentUser?.id ? 'me' : 'them',
          text: m.text,
          time: m.time,
          read: true,
        })));
      }
    }).catch((err) => {
      if (__DEV__) console.warn('Message history load failed:', err);
    });
  }, [session, conversationId]);

  // Listen for real-time messages
  useEffect(() => {
    if (!conversationId) return;
    const unsub = onMessage(conversationId, (msg) => {
      if (!msg) return;
      // Deduplicate own messages (server echo)
      if (sentIdsRef.current.has(msg.id)) return;
      setMessages((prev) => [...prev, {
        id: msg.id,
        sender: msg.senderId === currentUser?.id ? 'me' : 'them',
        text: msg.body,
        time: new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        read: true,
      }]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [conversationId, currentUser?.id]);

  // Listen for typing indicators
  useEffect(() => {
    const unsubStart = onTypingStart(({ conversationId: cid }) => {
      if (cid === conversationId) setIsTyping(true);
    });
    const unsubStop = onTypingStop(({ conversationId: cid }) => {
      if (cid === conversationId) setIsTyping(false);
    });
    return () => { unsubStart(); unsubStop(); };
  }, [conversationId]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();

    // Optimistic UI
    const optimisticId = `msg-${Date.now()}`;
    const newMessage = {
      id: optimisticId,
      sender: 'me',
      text,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      read: false,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText('');

    // Send via chatService — Realtime picks up the new message
    if (conversationId) {
      chatService.sendMessage(conversationId, text).then((result) => {
        if (result?.id) {
          sentIdsRef.current.add(result.id);
          // Replace optimistic message with server message
          setMessages((prev) => prev.map((m) => m.id === optimisticId ? { ...m, id: result.id, read: true } : m));
        }
      }).catch(() => {});
    }

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleVoiceNote = () => {
    Alert.alert('Voice Note', 'Voice notes coming soon! This feature will be available in the next update.');
  };

  const handlePhoto = () => {
    Alert.alert('Send Photo', 'Photo sharing coming soon! This feature will be available in the next update.');
  };

  const handleVideoCall = () => {
    if (!hasTier('plus')) {
      Alert.alert('JuNubin+ Feature', 'Video calls require JuNubin+ or higher.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert('Video Call', `Starting video call with ${match.name}...`, [
      { text: 'OK' },
    ]);
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender === 'me';
    return (
      <View style={[styles.messageBubbleWrap, isMe ? styles.myMessage : styles.theirMessage]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
          <Text style={[styles.bubbleText, isMe ? styles.myBubbleText : styles.theirBubbleText]}>
            {item.text}
          </Text>
        </View>
        <View style={[styles.timeRow, isMe && { justifyContent: 'flex-end' }]}>
          <Text style={styles.timeText}>{item.time}</Text>
          {isMe && (
            <Ionicons
              name={item.read ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={item.read ? colors.accent : colors.gray400}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.black} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerProfile} activeOpacity={0.7}>
          <Image source={imageSource(match.images?.[0])} style={styles.headerAvatar} />
          <View>
            <Text style={styles.headerName}>{match.name || 'Chat'}</Text>
            <Text style={styles.headerStatus}>
              {isTyping ? 'typing...' : 'Online'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleVideoCall} style={styles.headerIcon}>
            <Ionicons name="videocam" size={22} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.gray} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={true}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={
          <View style={styles.matchBanner}>
            <Image source={imageSource(match.images?.[0])} style={styles.bannerAvatar} />
            <Text style={styles.bannerText}>You matched with {match.name}!</Text>
            <Text style={styles.bannerSub}>Say something nice to start the conversation</Text>
          </View>
        }
      />

      {/* Typing indicator */}
      {isTyping && (
        <View style={styles.typingIndicator}>
          <View style={styles.typingDots}>
            <View style={[styles.typingDot, { opacity: 0.4 }]} />
            <View style={[styles.typingDot, { opacity: 0.6 }]} />
            <View style={[styles.typingDot, { opacity: 0.8 }]} />
          </View>
          <Text style={styles.typingText}>{match.name} is typing...</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity onPress={handlePhoto} style={styles.inputIcon}>
          <Ionicons name="image" size={24} color={colors.accent} />
        </TouchableOpacity>

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.gray400}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            returnKeyType="default"
          />
        </View>

        {inputText.trim() ? (
          <TouchableOpacity onPress={handleSend} style={styles.sendBtn}>
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleVoiceNote} style={styles.inputIcon}>
            <Ionicons name="mic" size={24} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gray200,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.gray300,
  },
  headerName: {
    ...Typography.sectionLabel,
    color: colors.black,
  },
  headerStatus: {
    ...Typography.caption,
    color: colors.accent,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIcon: {
    padding: 6,
  },
  messagesList: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  matchBanner: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  bannerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.accent,
    marginBottom: 12,
    backgroundColor: colors.gray300,
  },
  bannerText: {
    ...Typography.bodySemibold,
    color: colors.black,
  },
  bannerSub: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: 4,
  },
  messageBubbleWrap: {
    marginVertical: 3,
    maxWidth: '78%',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: colors.gray200,
  },
  bubbleText: {
    ...Typography.bodySmall,
    fontSize: 15,
    lineHeight: 21,
  },
  myBubbleText: {
    color: '#FFFFFF',
  },
  theirBubbleText: {
    color: colors.black,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    paddingHorizontal: 4,
  },
  timeText: {
    ...Typography.caption,
    fontSize: 11,
    color: colors.gray400,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 8,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 3,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray400,
  },
  typingText: {
    ...Typography.caption,
    color: colors.gray400,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: 0.5,
    borderTopColor: colors.gray200,
    gap: 8,
  },
  inputIcon: {
    padding: 8,
    marginBottom: 2,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    borderWidth: 0.5,
    borderColor: colors.gray200,
  },
  textInput: {
    ...Typography.bodySmall,
    fontSize: 15,
    color: colors.black,
    maxHeight: 80,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});
