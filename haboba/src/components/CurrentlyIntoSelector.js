import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Typography, FontFamily } from '../theme';
import { useAuth } from '../auth';
import * as profileService from '../api/services/profileService';

const MAX_SELECTIONS = 3;

export default function CurrentlyIntoSelector({ value = [], onChange }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { accessToken } = useAuth();
  const [trending, setTrending] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => new Set(value.map((s) => s.toLowerCase())), [value]);

  useEffect(() => {
    if (!accessToken) return;
    profileService
      .getTrendingCurrentlyInto(accessToken)
      .then((data) => {
        setTrending((data.trending || []).map((t) => t.item));
        setSuggestions(data.suggestions || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const allOptions = useMemo(() => {
    const seen = new Set();
    const items = [];
    // Show user's current selections first, then trending, then curated suggestions
    for (const item of [...value, ...trending, ...suggestions]) {
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        items.push(item);
      }
    }
    return items;
  }, [value, trending, suggestions]);

  const toggle = useCallback(
    (item) => {
      const key = item.toLowerCase();
      if (selected.has(key)) {
        onChange(value.filter((v) => v.toLowerCase() !== key));
      } else {
        if (value.length >= MAX_SELECTIONS) {
          Alert.alert('Limit Reached', `You can select up to ${MAX_SELECTIONS} items.`);
          return;
        }
        onChange([...value, item]);
      }
    },
    [value, selected, onChange]
  );

  const handleSave = useCallback(async () => {
    if (!accessToken) return;
    setSaving(true);
    try {
      await profileService.updateCurrentlyInto(accessToken, value);
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [accessToken, value]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.chipsWrap}>
        {allOptions.map((item) => {
          const isSelected = selected.has(item.toLowerCase());
          return (
            <TouchableOpacity
              key={item}
              style={[styles.chip, isSelected && styles.chipActive]}
              onPress={() => toggle(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                {item}
              </Text>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={16} color={colors.accent} style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {value.length > 0 && (
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    container: { gap: 12 },
    loadingContainer: { paddingVertical: 20, alignItems: 'center' },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.gray200,
      backgroundColor: colors.white,
      flexDirection: 'row',
      alignItems: 'center',
    },
    chipActive: {
      borderColor: colors.accent,
      backgroundColor: 'rgba(255, 82, 82, 0.08)',
    },
    chipText: {
      ...Typography.bodySmallMedium,
      color: colors.gray,
    },
    chipTextActive: {
      color: colors.accent,
      fontWeight: '600',
      fontFamily: FontFamily.semibold,
    },
    saveBtn: {
      backgroundColor: colors.accent,
      paddingVertical: 10,
      paddingHorizontal: 24,
      borderRadius: 20,
      alignSelf: 'flex-start',
      minWidth: 80,
      alignItems: 'center',
    },
    saveBtnText: {
      ...Typography.label,
      color: '#FFFFFF',
      fontWeight: '700',
      fontFamily: FontFamily.bold,
    },
  });
