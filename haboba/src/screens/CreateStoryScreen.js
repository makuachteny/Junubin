// AnaJunubin — Create Story Screen (photo or text)
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, Typography, FontFamily } from '../theme';
import Button from '../components/Button';

const BG_COLORS = ['#0047AB', '#0047AB', '#009739', '#CE1126', '#009739', '#EC4899'];

export default function CreateStoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [mode, setMode] = useState('text'); // 'text' or 'photo'
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [photoUri, setPhotoUri] = useState(null);

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo access to create photo stories.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handlePost = () => {
    if (mode === 'text' && !text.trim()) {
      Alert.alert('Empty Story', 'Please write something for your story.');
      return;
    }
    if (mode === 'photo' && !photoUri) {
      Alert.alert('No Photo', 'Please select a photo for your story.');
      return;
    }
    Alert.alert('Story Posted!', 'Your story is now visible to your connections.');
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        <TouchableOpacity onPress={handlePost}>
          <Text style={styles.postText}>Post</Text>
        </TouchableOpacity>
      </View>

      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'text' && { backgroundColor: colors.accent }]}
          onPress={() => setMode('text')}
        >
          <Text style={[styles.modeBtnText, mode === 'text' && { color: '#FFF' }]}>Text</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'photo' && { backgroundColor: colors.accent }]}
          onPress={() => setMode('photo')}
        >
          <Text style={[styles.modeBtnText, mode === 'photo' && { color: '#FFF' }]}>Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, { backgroundColor: '#CE1126' }]}
          onPress={() => { navigation.goBack(); navigation.navigate('GoLive'); }}
        >
          <Ionicons name="radio" size={14} color="#FFF" style={{ marginRight: 4 }} />
          <Text style={[styles.modeBtnText, { color: '#FFF' }]}>Live</Text>
        </TouchableOpacity>
      </View>

      {mode === 'text' ? (
        <View style={styles.textPreview}>
          <View style={[styles.textBg, { backgroundColor: bgColor }]}>
            <TextInput
              style={styles.storyInput}
              placeholder="What's on your mind?"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={200}
              textAlign="center"
            />
          </View>

          {/* Color picker */}
          <View style={styles.colorRow}>
            {BG_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, bgColor === c && styles.colorDotActive]}
                onPress={() => setBgColor(c)}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.photoPlaceholder}>
          {photoUri ? (
            <TouchableOpacity onPress={handlePickPhoto} style={{ flex: 1, width: '100%' }}>
              <Image source={{ uri: photoUri }} style={{ flex: 1, borderRadius: 20 }} resizeMode="cover" />
            </TouchableOpacity>
          ) : (
            <>
              <Ionicons name="image" size={48} color={colors.gray400} />
              <Text style={[styles.placeholderText, { color: colors.gray }]}>Choose a photo for your story</Text>
              <Button title="Select Photo" variant="outline" size="md" onPress={handlePickPhoto} />
            </>
          )}
        </View>
      )}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  headerTitle: {
    fontSize: 34,
    fontFamily: FontFamily.black,
    color: colors.black,
    letterSpacing: 0.3,
  },
  postText: { ...Typography.bodySemibold, color: colors.accent },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.gray100,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },
  textPreview: { flex: 1, padding: 16 },
  textBg: {
    flex: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  storyInput: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    width: '100%',
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  placeholderText: { fontSize: 15 },
});
