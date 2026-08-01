// MessageRequestComposer — the short note you attach when asking
// someone you aren't connected with to start a conversation.
//
// Deliberately small: one text field, a character budget, cancel and
// send. The note is the only thing the recipient sees before they
// decide, so the placeholder nudges people to say who they are rather
// than opening with a request.
//
// Used by ProfileDetailScreen. The parent owns
// the messageRequestService call and the success/failure alerts — this
// component just collects the text.

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';

// Matches MAX_MESSAGE_LENGTH in messageRequestService — the server
// truncates past this, so the counter has to agree with it or people
// lose text they thought they'd sent.
const MAX_LENGTH = 500;

export default function MessageRequestComposer({ visible, name, onCancel, onSend }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Reset between openings so a cancelled draft doesn't reappear when
  // the user opens the composer for a different person.
  useEffect(() => {
    if (visible) {
      setText('');
      setSending(false);
    }
  }, [visible]);

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await onSend?.(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Close message request"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Message {name || 'this person'}</Text>
          <Text style={styles.subtitle}>
            You are not connected yet, so this goes over as a request. Say who
            you are and why you are reaching out — they decide whether to reply.
          </Text>

          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(t) => setText(t.slice(0, MAX_LENGTH))}
            placeholder="Hi — I'm from Juba too, saw you work in logistics…"
            placeholderTextColor={colors.gray400}
            multiline
            maxLength={MAX_LENGTH}
            autoFocus
            textAlignVertical="top"
            accessibilityLabel="Your message request note"
          />
          <Text style={styles.counter}>{trimmed.length}/{MAX_LENGTH}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!canSend}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Send message request"
              accessibilityState={{ disabled: !canSend }}
            >
              {sending
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.sendText}>Send request</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray300,
    marginBottom: 6,
  },
  title: {
    ...Typography.h4,
    color: colors.black,
  },
  subtitle: {
    ...Typography.caption,
    color: colors.gray500,
    lineHeight: 19,
  },
  input: {
    ...Typography.bodySmall,
    color: colors.black,
    minHeight: 110,
    maxHeight: 200,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  counter: {
    ...Typography.caption,
    fontSize: 12,
    color: colors.gray400,
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray300,
  },
  cancelText: {
    ...Typography.label,
    fontSize: 15,
    color: colors.gray600,
  },
  sendBtn: {
    flex: 2,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendText: {
    ...Typography.label,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
