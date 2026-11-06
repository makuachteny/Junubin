import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../theme';
import { reportError } from '../utils/reportError';

// Catches render-phase exceptions in the wrapped subtree and shows a
// retry surface instead of unmounting silently. Reports to Sentry with
// a `boundary` tag so we can tell screen-scope crashes apart from
// app-root crashes in the dashboard.
export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    const boundary = this.props.boundary || 'app';
    reportError(`ErrorBoundary:${boundary}`, error, {
      componentStack: info?.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>:(</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>The app ran into a problem. Please try again.</Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cream,
    padding: 32,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.gray800, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.gray500, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  button: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: { color: Colors.creamLight, fontWeight: '700', fontSize: 15 },
});
