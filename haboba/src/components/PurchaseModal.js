import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Typography, FontFamily } from '../theme';
import Button from './Button';

// type: 'loading' | 'success' | 'error'
export default function PurchaseModal({ visible, type = 'loading', title, message, onDismiss }) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 6,
          tension: 80,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, type]);

  const iconConfig = {
    loading: null,
    success: { name: 'checkmark-circle', color: colors.accent },
    error: { name: 'close-circle', color: colors.error || '#C95D4F' },
  };

  const icon = iconConfig[type];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.cardBg, transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {type === 'loading' ? (
            <>
              <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
              <Text style={[styles.title, { color: colors.black }]}>
                {title || 'Processing...'}
              </Text>
              {message && (
                <Text style={[styles.message, { color: colors.gray600 }]}>{message}</Text>
              )}
            </>
          ) : (
            <>
              <View style={[styles.iconCircle, { backgroundColor: icon.color + '15' }]}>
                <Ionicons name={icon.name} size={52} color={icon.color} />
              </View>
              <Text style={[styles.title, { color: colors.black }]}>
                {title || (type === 'success' ? 'Purchase Complete!' : 'Something Went Wrong')}
              </Text>
              {message && (
                <Text style={[styles.message, { color: colors.gray600 }]}>{message}</Text>
              )}
              <View style={styles.btnWrap}>
                <Button
                  title={type === 'success' ? 'Done' : 'Try Again'}
                  variant={type === 'success' ? 'primary' : 'outline'}
                  size="md"
                  onPress={onDismiss}
                />
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  loader: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    ...Typography.h2,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    ...Typography.bodySmall,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  btnWrap: {
    width: '100%',
    marginTop: 20,
  },
});
