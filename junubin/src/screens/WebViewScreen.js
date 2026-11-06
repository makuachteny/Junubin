import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme, Typography } from '../theme';

export default function WebViewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const url = route?.params?.url;
  const title = route?.params?.title || 'Browser';
  const [loading, setLoading] = useState(true);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={24} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.rightSpacer} />
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      )}

      <WebView
        source={{ uri: url }}
        onLoadEnd={() => setLoading(false)}
        startInLoadingState
        style={styles.webView}
      />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    backgroundColor: colors.white,
  },
  headerTitle: {
    ...Typography.sectionLabel,
    color: colors.black,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  rightSpacer: {
    width: 24,
  },
  webView: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    ...Typography.caption,
    color: colors.gray500,
  },
});
