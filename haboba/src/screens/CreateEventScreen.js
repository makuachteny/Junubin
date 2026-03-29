// AnaJunubin — Create Event Screen
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import Button from '../components/Button';

export default function CreateEventScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');

  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please give your event a name.');
      return;
    }
    Alert.alert('Event Created!', `"${title}" has been published. Others can now RSVP.`);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Event</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Event Name</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g., Junubin Mixer" placeholderTextColor={colors.gray400} />

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="What's the event about?" placeholderTextColor={colors.gray400} multiline />

        <Text style={styles.label}>Location</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="e.g., Juba Grand Hotel" placeholderTextColor={colors.gray400} />

        <Text style={styles.label}>Date & Time</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="e.g., March 15, 7:00 PM" placeholderTextColor={colors.gray400} />

        <View style={{ height: 24 }} />
        <Button title="Create Event" variant="primary" size="lg" fullWidth onPress={handleCreate} />
      </ScrollView>
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
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  label: {
    ...Typography.captionBold,
    color: colors.black,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FontFamily.medium,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
