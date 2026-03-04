import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import { GAME_CATALOG, GAME_TYPES } from '../data/games';
import { interactiveStore } from '../utils/interactiveStore';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function PressableRow({ style, onPress, children }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  return (
    <AnimatedTouchable
      style={[style, { transform: [{ scale: scaleAnim }] }]}
      onPress={onPress}
      onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.97, tension: 68, friction: 10, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, tension: 68, friction: 10, useNativeDriver: true }).start()}
      activeOpacity={0.7}
    >
      {children}
    </AnimatedTouchable>
  );
}

export default function GameSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [customQuestions, setCustomQuestions] = useState({});
  const [expandedType, setExpandedType] = useState(null);
  const [adding, setAdding] = useState(null); // gameType currently adding to
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');
  const [inputQuestion, setInputQuestion] = useState('');
  const [inputOptions, setInputOptions] = useState(['', '', '', '']);
  const [inputCorrect, setInputCorrect] = useState(0);

  useEffect(() => {
    const load = async () => {
      const result = {};
      for (const game of GAME_CATALOG) {
        result[game.type] = await interactiveStore.getCustomQuestions(game.type);
      }
      setCustomQuestions(result);
    };
    load();
  }, []);

  const saveQuestions = useCallback(async (gameType, questions) => {
    setCustomQuestions((prev) => ({ ...prev, [gameType]: questions }));
    await interactiveStore.setCustomQuestions(gameType, questions);
  }, []);

  const handleDelete = useCallback((gameType, index) => {
    const current = customQuestions[gameType] || [];
    const updated = current.filter((_, i) => i !== index);
    saveQuestions(gameType, updated);
  }, [customQuestions, saveQuestions]);

  const handleAdd = useCallback((gameType) => {
    const isTrivia = gameType === GAME_TYPES.trivia;

    if (isTrivia) {
      if (!inputQuestion.trim() || inputOptions.some((o) => !o.trim())) {
        Alert.alert('Incomplete', 'Please fill in the question and all 4 options.');
        return;
      }
      const newQ = {
        id: `custom_${Date.now()}`,
        question: inputQuestion.trim(),
        options: inputOptions.map((o) => o.trim()),
        correctIndex: inputCorrect,
      };
      const current = customQuestions[gameType] || [];
      saveQuestions(gameType, [...current, newQ]);
      setInputQuestion('');
      setInputOptions(['', '', '', '']);
      setInputCorrect(0);
    } else {
      if (!inputA.trim() || !inputB.trim()) {
        Alert.alert('Incomplete', 'Please fill in both options.');
        return;
      }
      const newQ = {
        id: `custom_${Date.now()}`,
        optionA: inputA.trim(),
        optionB: inputB.trim(),
      };
      if (gameType === GAME_TYPES.vibe_check) {
        newQ.question = inputQuestion.trim() || 'Custom question';
      }
      const current = customQuestions[gameType] || [];
      saveQuestions(gameType, [...current, newQ]);
      setInputA('');
      setInputB('');
      setInputQuestion('');
    }
    setAdding(null);
  }, [inputA, inputB, inputQuestion, inputOptions, inputCorrect, customQuestions, saveQuestions]);

  const isTrivia = (type) => type === GAME_TYPES.trivia;
  const isVibeCheck = (type) => type === GAME_TYPES.vibe_check;

  const renderQuestionPreview = (gameType, q, index) => {
    if (isTrivia(gameType)) {
      return (
        <View key={q.id || index} style={styles.questionRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.questionText}>{q.question}</Text>
            <Text style={styles.questionOptions}>
              {q.options?.map((o, i) => `${i === q.correctIndex ? '\u2713 ' : ''}${o}`).join('  |  ')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => handleDelete(gameType, index)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={22} color={colors.gray400} />
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View key={q.id || index} style={styles.questionRow}>
        <View style={{ flex: 1 }}>
          {q.question && <Text style={styles.questionLabel}>{q.question}</Text>}
          <Text style={styles.questionText}>{q.optionA}  vs  {q.optionB}</Text>
        </View>
        <TouchableOpacity onPress={() => handleDelete(gameType, index)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close-circle" size={22} color={colors.gray400} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderAddForm = (gameType) => {
    if (adding !== gameType) return null;

    if (isTrivia(gameType)) {
      return (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="Question"
            placeholderTextColor={colors.gray400}
            value={inputQuestion}
            onChangeText={setInputQuestion}
          />
          {inputOptions.map((opt, i) => (
            <View key={i} style={styles.optionInputRow}>
              <TouchableOpacity
                style={[styles.correctDot, inputCorrect === i && styles.correctDotActive]}
                onPress={() => setInputCorrect(i)}
              >
                {inputCorrect === i && <View style={[styles.correctDotInner, { backgroundColor: colors.accent }]} />}
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder={`Option ${i + 1}`}
                placeholderTextColor={colors.gray400}
                value={opt}
                onChangeText={(text) => {
                  const updated = [...inputOptions];
                  updated[i] = text;
                  setInputOptions(updated);
                }}
              />
            </View>
          ))}
          <Text style={styles.hintText}>Tap the circle to mark the correct answer</Text>
          <View style={styles.addActions}>
            <TouchableOpacity onPress={() => setAdding(null)} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: colors.gray400 }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleAdd(gameType)} style={[styles.saveBtn, { backgroundColor: colors.accent }]}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.addForm}>
        {isVibeCheck(gameType) && (
          <TextInput
            style={styles.input}
            placeholder="Question (e.g. Morning routine?)"
            placeholderTextColor={colors.gray400}
            value={inputQuestion}
            onChangeText={setInputQuestion}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Option A"
          placeholderTextColor={colors.gray400}
          value={inputA}
          onChangeText={setInputA}
        />
        <TextInput
          style={styles.input}
          placeholder="Option B"
          placeholderTextColor={colors.gray400}
          value={inputB}
          onChangeText={setInputB}
        />
        <View style={styles.addActions}>
          <TouchableOpacity onPress={() => setAdding(null)} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.gray400 }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleAdd(gameType)} style={[styles.saveBtn, { backgroundColor: colors.accent }]}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Game Settings</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {GAME_CATALOG.map((game) => {
          const questions = customQuestions[game.type] || [];
          const isExpanded = expandedType === game.type;

          return (
            <View key={game.type} style={styles.sectionCard}>
              <PressableRow
                style={styles.sectionHeader}
                onPress={() => setExpandedType(isExpanded ? null : game.type)}
              >
                <Text style={styles.gameEmoji}>{game.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gameName}>{game.name}</Text>
                  <Text style={styles.questionCount}>
                    {questions.length} custom question{questions.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.gray400}
                />
              </PressableRow>

              {isExpanded && (
                <View style={styles.expandedContent}>
                  {questions.length === 0 && (
                    <Text style={styles.emptyText}>No custom questions yet</Text>
                  )}
                  {questions.map((q, i) => renderQuestionPreview(game.type, q, i))}

                  {renderAddForm(game.type)}

                  {adding !== game.type && (
                    <PressableRow
                      style={styles.addRow}
                      onPress={() => {
                        setAdding(game.type);
                        setInputA('');
                        setInputB('');
                        setInputQuestion('');
                        setInputOptions(['', '', '', '']);
                        setInputCorrect(0);
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
                      <Text style={[styles.addText, { color: colors.accent }]}>Add Question</Text>
                    </PressableRow>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
  },
  headerTitle: {
    fontSize: 34,
    fontFamily: FontFamily.script,
    color: colors.black,
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  doneText: {
    ...Typography.bodySemibold,
    color: colors.accent,
  },
  content: {
    paddingHorizontal: 16,
    gap: 14,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    overflow: 'hidden',
    ...getShadow('sm', isDark),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  gameEmoji: {
    fontSize: 28,
  },
  gameName: {
    ...Typography.bodySemibold,
    color: colors.black,
    fontSize: 15,
  },
  questionCount: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: 2,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: colors.separator,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: colors.gray400,
    textAlign: 'center',
    paddingVertical: 16,
    fontFamily: FontFamily.medium,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  questionText: {
    ...Typography.bodySmall,
    color: colors.black,
    fontFamily: FontFamily.medium,
  },
  questionLabel: {
    ...Typography.caption,
    color: colors.gray400,
    marginBottom: 2,
  },
  questionOptions: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: 2,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  addText: {
    ...Typography.bodySemibold,
    fontSize: 14,
  },
  addForm: {
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...Typography.bodySmall,
    color: colors.black,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.white,
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  correctDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  correctDotActive: {
    borderColor: colors.accent,
  },
  correctDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  hintText: {
    ...Typography.caption,
    color: colors.gray400,
    fontFamily: FontFamily.regular,
  },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelText: {
    ...Typography.bodySemibold,
    fontSize: 14,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveText: {
    ...Typography.bodySemibold,
    fontSize: 14,
    color: '#FFF',
  },
});
