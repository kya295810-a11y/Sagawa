import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';

import { useAppTheme } from '@/theme/provider';
import { apiRequest } from '@/services/api/client';
import { ApiError } from '@/services/api/errors';
import { ApiResponse, Profile } from '@/types/profile';

const EMPTY_PROFILE: Profile = {
  name: '',
  phoneNumber: '',
  address: '',
  profileImage: '',
};

export default function PersonalInformationScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);

  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [draft, setDraft] = useState<Profile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);

      const response = await apiRequest<ApiResponse<Profile>>('/api/profile');

      setProfile(response.data);
      setDraft(response.data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setProfile(EMPTY_PROFILE);
        setDraft(EMPTY_PROFILE);
        return;
      }

      console.error('Personal information load error:', error);
      setProfile(EMPTY_PROFILE);
      setDraft(EMPTY_PROFILE);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const startEditing = () => {
    setDraft(profile);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(profile);
    setIsEditing(false);
  };

  const saveProfile = async () => {
    if (!draft.name.trim()) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }

    try {
      setSaving(true);

      const response = await apiRequest<ApiResponse<Profile>>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: draft.name.trim(),
          phoneNumber: draft.phoneNumber.trim(),
          address: draft.address.trim(),
        }),
      });

      setProfile(response.data);
      setDraft(response.data);
      setIsEditing(false);

      Alert.alert('Success', 'Your information has been updated.');
    } catch (error) {
      console.error('Personal information save error:', error);
      Alert.alert('Update Failed', 'Unable to save your information. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhonePress = async () => {
    if (!profile.phoneNumber.trim()) {
      return;
    }

    const url = `tel:${profile.phoneNumber}`;
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    }
  };

  const handleAddressPress = async () => {
    if (!profile.address.trim()) {
      return;
    }

    const query = encodeURIComponent(profile.address);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await Linking.openURL(url);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerButton}>
        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
      </Pressable>

      <Text style={styles.headerTitle} allowFontScaling={false}>
        Personal Information
      </Text>

      {!loading && !loadError && !isEditing ? (
        <Pressable onPress={startEditing} hitSlop={10} style={styles.headerButton}>
          <Ionicons name="pencil" size={20} color={theme.colors.primary} />
        </Pressable>
      ) : (
        <View style={styles.headerButton} />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={theme.statusBarStyle} />

      {renderHeader()}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : loadError ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Unable to load your information.</Text>
          <Pressable onPress={loadProfile} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {isEditing ? (
            <View>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                value={draft.name}
                onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={theme.colors.textMuted}
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                value={draft.phoneNumber}
                onChangeText={(value) =>
                  setDraft((current) => ({ ...current, phoneNumber: value }))
                }
                style={styles.input}
                placeholder="Phone number"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                value={draft.address}
                onChangeText={(value) => setDraft((current) => ({ ...current, address: value }))}
                style={[styles.input, styles.addressInput]}
                placeholder="Your address"
                placeholderTextColor={theme.colors.textMuted}
                multiline
              />

              <View style={styles.editActions}>
                <Pressable onPress={cancelEditing} style={styles.cancelButton} disabled={saving}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={saveProfile}
                  disabled={saving}
                  style={[styles.saveButton, saving && styles.disabledButton]}
                >
                  <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.sectionCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconColumn}>
                  <Ionicons name="person-outline" size={20} color={theme.colors.text} />
                </View>
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>{profile.name || 'Not set'}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <Pressable
                onPress={handlePhonePress}
                style={styles.infoRow}
                disabled={!profile.phoneNumber.trim()}
              >
                <View style={styles.infoIconColumn}>
                  <Ionicons name="call-outline" size={20} color={theme.colors.text} />
                </View>
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <Text style={styles.infoValue}>{profile.phoneNumber || 'Not set'}</Text>
                </View>
                {profile.phoneNumber.trim() ? (
                  <Ionicons name="chevron-forward" size={17} color={theme.colors.textMuted} />
                ) : null}
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                onPress={handleAddressPress}
                style={styles.infoRow}
                disabled={!profile.address.trim()}
              >
                <View style={styles.infoIconColumn}>
                  <Ionicons name="location-outline" size={20} color={theme.colors.text} />
                </View>
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue}>{profile.address || 'Not set'}</Text>
                </View>
                {profile.address.trim() ? (
                  <Ionicons name="chevron-forward" size={17} color={theme.colors.textMuted} />
                ) : null}
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: {
  background: string;
  surface: string;
  elevated: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
}) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 28,
    },
    header: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    headerButton: {
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: colors.text,
      fontSize: 17,
      fontWeight: '600',
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    errorText: {
      color: colors.textMuted,
      fontSize: 15,
      marginBottom: 16,
      textAlign: 'center',
    },
    retryButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },
    sectionCard: {
      overflow: 'hidden',
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    infoRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    infoIconColumn: {
      width: 34,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    infoText: {
      flex: 1,
      minWidth: 0,
      paddingRight: 10,
    },
    infoLabel: {
      color: colors.textMuted,
      fontSize: 12,
      marginBottom: 2,
    },
    infoValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 48,
      backgroundColor: colors.border,
    },
    inputLabel: {
      marginBottom: 7,
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    input: {
      minHeight: 52,
      marginBottom: 18,
      paddingHorizontal: 14,
      borderRadius: 14,
      color: colors.text,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 16,
    },
    addressInput: {
      minHeight: 90,
      paddingTop: 14,
      textAlignVertical: 'top',
    },
    editActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 6,
    },
    cancelButton: {
      flex: 1,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    saveButton: {
      flex: 1,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    disabledButton: {
      opacity: 0.6,
    },
    cancelText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    saveText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });
