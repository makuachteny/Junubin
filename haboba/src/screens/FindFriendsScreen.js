// JuNubin — Find Friends from Contacts
// Accesses device contacts to find people already on the app
// and invite those who aren't.

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Share,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import { imageSource } from '../utils/imageSource';
import { useAuth } from '../auth';
import { useSubscription } from '../payments';

// Simulated backend lookup — in production this would POST phone numbers
// to the server and return matched user profiles.
const lookupContactsOnApp = async (phoneNumbers) => {
  // Simulate API delay
  await new Promise((r) => setTimeout(r, 800));

  // For demo purposes, randomly mark ~20% of contacts as "on app"
  const matched = [];
  phoneNumbers.forEach((entry) => {
    if (Math.random() < 0.2) {
      matched.push({
        phoneNumber: entry.phoneNumber,
        userId: `user-${entry.phoneNumber.replace(/\D/g, '').slice(-6)}`,
        name: entry.contactName,
        avatar: null,
        isFollowing: false,
      });
    }
  });
  return matched;
};

const FindFriendsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { canUseDiasporaConnect } = useSubscription();
  const [permissionStatus, setPermissionStatus] = useState(null); // null | 'granted' | 'denied'
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]); // all contacts
  const [onAppUsers, setOnAppUsers] = useState([]); // contacts found on app
  const [notOnApp, setNotOnApp] = useState([]); // contacts not on app
  const [followedIds, setFollowedIds] = useState(new Set());
  const [invitedNumbers, setInvitedNumbers] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const styles = useMemo(() => getStyles(colors, isDark, insets), [colors, isDark, insets]);

  const requestContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      setPermissionStatus(status);

      if (status !== 'granted') {
        setLoading(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name, Contacts.Fields.Image],
        sort: Contacts.SortTypes.FirstName,
      });

      if (!data || data.length === 0) {
        setContacts([]);
        setLoading(false);
        return;
      }

      // Normalize contacts with phone numbers
      const withPhones = data
        .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0 && c.name)
        .map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phoneNumbers[0].number,
          image: c.image?.uri || null,
        }));

      setContacts(withPhones);

      // Look up which contacts are on the app
      const phoneEntries = withPhones.map((c) => ({
        phoneNumber: c.phone,
        contactName: c.name,
      }));

      const matched = await lookupContactsOnApp(phoneEntries);
      const matchedPhones = new Set(matched.map((m) => m.phoneNumber));

      setOnAppUsers(matched);
      setNotOnApp(withPhones.filter((c) => !matchedPhones.has(c.phone)));
    } catch (err) {
      Alert.alert('Error', 'Could not access contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFollow = useCallback((userId) => {
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const handleInvite = useCallback(async (contact) => {
    try {
      await Share.share({
        message: `Hey ${contact.name}! Join me on JuNubin — the app for South Sudanese to connect, date, and build community. Download it here: https://eastside.app/invite`,
      });
      setInvitedNumbers((prev) => new Set(prev).add(contact.phone));
    } catch (_) {
      // User cancelled share
    }
  }, []);

  const handleInviteAll = useCallback(async () => {
    try {
      await Share.share({
        message: 'Join me on JuNubin — the app for South Sudanese to connect, date, and build community. Download it here: https://eastside.app/invite',
      });
    } catch (_) {
      // User cancelled
    }
  }, []);

  // Filter contacts by search
  const filteredOnApp = useMemo(() => {
    if (!searchQuery.trim()) return onAppUsers;
    const q = searchQuery.toLowerCase();
    return onAppUsers.filter((u) => u.name.toLowerCase().includes(q));
  }, [onAppUsers, searchQuery]);

  const filteredNotOnApp = useMemo(() => {
    if (!searchQuery.trim()) return notOnApp;
    const q = searchQuery.toLowerCase();
    return notOnApp.filter((c) => c.name.toLowerCase().includes(q));
  }, [notOnApp, searchQuery]);

  // Permission not yet requested
  if (permissionStatus === null && !loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : colors.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Find Friends</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.permissionCard}>
          <View style={[styles.permissionIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F6' }]}>
            <Ionicons name="people" size={48} color={colors.accent} />
          </View>
          <Text style={styles.permissionTitle}>Find your people</Text>
          <Text style={styles.permissionDesc}>
            See which of your contacts are already on JuNubin and invite friends who haven't joined yet.
          </Text>
          <Text style={styles.permissionNote}>
            We only use your contacts to find matches. Your contact list is never stored on our servers.
          </Text>
          <TouchableOpacity style={[styles.permissionBtn, { backgroundColor: colors.accent }]} onPress={requestContacts} activeOpacity={0.85}>
            <Ionicons name="phone-portrait-outline" size={18} color="#FFFFFF" />
            <Text style={styles.permissionBtnText}>Access Contacts</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Permission denied
  if (permissionStatus === 'denied') {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : colors.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Find Friends</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.permissionCard}>
          <Ionicons name="lock-closed" size={48} color={colors.gray400} />
          <Text style={styles.permissionTitle}>Contacts access denied</Text>
          <Text style={styles.permissionDesc}>
            To find friends on JuNubin, please enable contacts access in your device settings.
          </Text>
        </View>
      </View>
    );
  }

  // Loading
  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : colors.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Find Friends</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Checking your contacts...</Text>
        </View>
      </View>
    );
  }

  // Results
  const sections = [];
  if (filteredOnApp.length > 0) {
    sections.push({ type: 'sectionHeader', title: `On JuNubin (${filteredOnApp.length})`, key: 'h-on' });
    filteredOnApp.forEach((u) => sections.push({ type: 'onApp', data: u, key: `on-${u.userId}` }));
  }
  if (filteredNotOnApp.length > 0) {
    sections.push({ type: 'sectionHeader', title: `Invite to JuNubin (${filteredNotOnApp.length})`, key: 'h-off' });
    filteredNotOnApp.forEach((c) => sections.push({ type: 'notOnApp', data: c, key: `off-${c.id}` }));
  }

  const renderItem = ({ item }) => {
    if (item.type === 'sectionHeader') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
          {item.title.includes('Invite') && (
            <TouchableOpacity onPress={handleInviteAll} activeOpacity={0.7}>
              <Text style={[styles.inviteAllText, { color: colors.accent }]}>Invite All</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    if (item.type === 'onApp') {
      const user = item.data;
      const isFollowed = followedIds.has(user.userId);
      return (
        <View style={styles.contactRow}>
          <View style={[styles.contactAvatar, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F6' }]}>
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.contactAvatarImg} />
            ) : (
              <Text style={[styles.contactInitial, { color: colors.accent }]}>{user.name.charAt(0)}</Text>
            )}
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{user.name}</Text>
            <Text style={styles.contactSub}>On JuNubin</Text>
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, isFollowed ? styles.actionBtnFollowed : { backgroundColor: colors.accent }]}
            onPress={() => handleFollow(user.userId)}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBtnText, isFollowed && styles.actionBtnTextFollowed]}>
              {isFollowed ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (item.type === 'notOnApp') {
      const contact = item.data;
      const isInvited = invitedNumbers.has(contact.phone);
      return (
        <View style={styles.contactRow}>
          <View style={[styles.contactAvatar, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.gray100 }]}>
            {contact.image ? (
              <Image source={{ uri: contact.image }} style={styles.contactAvatarImg} />
            ) : (
              <Text style={[styles.contactInitial, { color: isDark ? 'rgba(255,255,255,0.4)' : colors.gray400 }]}>{contact.name.charAt(0)}</Text>
            )}
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{contact.name}</Text>
            <Text style={styles.contactSub}>{contact.phone}</Text>
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, isInvited ? styles.actionBtnInvited : styles.actionBtnInvite]}
            onPress={() => handleInvite(contact)}
            activeOpacity={0.8}
            disabled={isInvited}
          >
            {!isInvited && <Ionicons name="paper-plane-outline" size={14} color={colors.accent} style={{ marginRight: 4 }} />}
            <Text style={[styles.actionBtnText, styles.actionBtnTextInvite, isInvited && { color: isDark ? 'rgba(255,255,255,0.3)' : colors.gray400 }]}>
              {isInvited ? 'Invited' : 'Invite'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Friends</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Diaspora Connect */}
      <TouchableOpacity
        style={styles.diasporaBtn}
        onPress={() => {
          if (!canUseDiasporaConnect()) {
            Alert.alert(
              'Junub Feature',
              'Diaspora Connect lets you find South Sudanese across cities and countries. Upgrade to Junub to unlock.',
              [
                { text: 'See Plans', onPress: () => navigation.navigate('Elite') },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
            return;
          }
          Alert.alert('Diaspora Connect', 'Search for South Sudanese in other cities and countries coming soon!');
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="globe-outline" size={18} color={colors.accent} />
        <Text style={styles.diasporaBtnText}>Diaspora Connect</Text>
        <Ionicons name="chevron-forward" size={16} color={isDark ? 'rgba(255,255,255,0.3)' : colors.gray400} />
      </TouchableOpacity>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={isDark ? 'rgba(255,255,255,0.4)' : colors.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : colors.gray400}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={isDark ? 'rgba(255,255,255,0.3)' : colors.gray400} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={sections}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={40} color={isDark ? 'rgba(255,255,255,0.2)' : colors.gray300} />
            <Text style={styles.emptyText}>No contacts found</Text>
          </View>
        }
      />
    </View>
  );
};

const getStyles = (colors, isDark, insets) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: isDark ? '#000000' : '#F5F3F0',
    paddingTop: insets.top,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: isDark ? '#FFFFFF' : colors.black,
  },

  // ── Diaspora Connect ──
  diasporaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.gray200,
    gap: 8,
  },
  diasporaBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: isDark ? '#FFFFFF' : colors.black,
  },

  // ── Search ──
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.regular,
    color: isDark ? '#FFFFFF' : colors.black,
    padding: 0,
  },

  // ── Permission screen ──
  permissionCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionIcon: {
    width: 96,
    height: 96,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: isDark ? '#FFFFFF' : colors.black,
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionDesc: {
    fontSize: 15,
    fontFamily: FontFamily.regular,
    color: isDark ? 'rgba(255,255,255,0.6)' : colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  permissionNote: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: isDark ? 'rgba(255,255,255,0.35)' : colors.gray400,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  permissionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
  },
  permissionBtnText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },

  // ── Loading ──
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: FontFamily.medium,
    color: isDark ? 'rgba(255,255,255,0.5)' : colors.gray500,
  },

  // ── List ──
  listContent: {
    paddingBottom: insets.bottom + 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: isDark ? 'rgba(255,255,255,0.5)' : colors.gray500,
    letterSpacing: 0.3,
  },
  inviteAllText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },

  // ── Contact row ──
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  contactAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 15,
  },
  contactInitial: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: isDark ? '#FFFFFF' : colors.black,
  },
  contactSub: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: isDark ? 'rgba(255,255,255,0.4)' : colors.gray400,
    marginTop: 2,
  },

  // ── Action buttons ──
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  actionBtnFollowed: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.2)' : colors.gray300,
  },
  actionBtnTextFollowed: {
    color: isDark ? 'rgba(255,255,255,0.6)' : colors.gray500,
  },
  actionBtnInvite: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.15)' : colors.gray200,
  },
  actionBtnTextInvite: {
    color: colors.accent,
  },
  actionBtnInvited: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.gray200,
  },

  // ── Empty ──
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: FontFamily.medium,
    color: isDark ? 'rgba(255,255,255,0.3)' : colors.gray400,
  },
});

export default FindFriendsScreen;
