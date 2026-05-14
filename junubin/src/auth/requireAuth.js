import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from './AuthContext';

/**
 * Returns a function that gates an action behind real authentication.
 *
 * Use for actions that require a real Supabase session (send chat, follow,
 * comment in a live, swipe persistence, etc.).
 *
 * Usage:
 *   const requireAuth = useRequireAuth();
 *   const onSendComment = () => {
 *     if (!requireAuth('Sign in to comment in live streams')) return;
 *     // ...send comment
 *   };
 *
 * Returns true when the user has a real session (action may proceed).
 * Returns false when blocked, and shows a Sign-In / Cancel alert that routes
 * to the Signup flow.
 */
export function useRequireAuth() {
  const { session } = useAuth();
  const navigation = useNavigation();

  return useCallback(
    (message = 'Please sign in to continue.') => {
      if (session) return true;
      Alert.alert('Sign in required', message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign In',
          onPress: () => {
            const root = navigation.getParent?.() || navigation;
            root.navigate?.('Signup');
          },
        },
      ]);
      return false;
    },
    [session, navigation]
  );
}
