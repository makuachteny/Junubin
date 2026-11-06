// MessageRequestComposer — the short note you attach when asking
// someone you aren't connected with to start a conversation.
//
// Deliberately small: one text field, a character budget, cancel and
// send. The note is the only thing the recipient sees before they
// decide, so the placeholder nudges people to say who they are rather
// than opening with a request.
//
// Used by ProfileDetailScreen. The parent owns the
// messageRequestService call and the success/failure alerts — this
// component just collects the text.
//
// Visual: the redesign has no bottom sheet of its own, so this borrows
// the design's own parts — square corners, hairline rules, a radius-4
// field, and the Person-detail action pair (46px, radius 4, 14.5pt
// semibold) with the same accent/hairline split as Accept/Decline in
// the Requests list. No pills, no large rounded cards.

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
import { useTheme, FontFamily } from '../theme';

// Matches MAX_MESSAGE_LENGTH in messageRequestService — the server
// truncates past this, so the counter has to agree with it or people
// lose text they thought they'd sent.
const MAX_LENGTH = 500;

export default function MessageRequestComposer({ visible, name, onCancel, onSend }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors), [colors]);
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
          <Text style={styles.kicker}>MESSAGE REQUEST</Text>
          <Text style={styles.title}>Message {name || 'this person'}</Text>
          <Text style={styles.subtitle}>
            One request per person. They see your note before your chat — say
            who you are and why you're reaching out.
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
              activeOpacity={0.85}
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
                ? <ActivityIndicator size="small" color={colors.cream} />
                : <Text style={styles.sendText}>Send request</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  // Square corners and a hairline top rule — the redesign has no
  // rounded cards.
  sheet: {
    backgroundColor: colors.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 8,
  },
  kicker: {
    fontFamily: FontFamily.semibold,
    fontSize: 10.5,
    letterSpacing: 1.05,
    color: colors.gray400,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: 24,
    color: colors.black,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.gray500,
  },
  input: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.black,
    minHeight: 110,
    maxHeight: 200,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    borderRadius: 4,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 2,
  },
  counter: {
    fontFamily: FontFamily.regular,
    fontSize: 11.5,
    color: colors.gray400,
    alignSelf: 'flex-end',
    marginTop: -2,
  },
  // Same pair as the Person-detail actions: two equal 46px buttons.
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14.5,
    color: colors.black,
  },
  sendBtn: {
    flex: 1,
    height: 46,
    borderRadius: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14.5,
    color: colors.cream,
  },
});
