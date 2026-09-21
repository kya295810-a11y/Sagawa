import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';
import { File as ExpoFile } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '@/services/api/client';
import { ApiError } from '@/services/api/errors';
import { useProfile, useUploadProfileImage } from '@/features/profile/hooks';
import { registerPushToken } from '@/services/notifications/push-token';
import { getStoredTokens } from '@/services/auth/token-storage';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';
import { useAppTheme } from '@/theme/provider';
import { Profile } from '@/types/profile';
import { getMediaUrl } from '@/utils/media';

type MenuItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const ACCOUNT_ITEMS: MenuItem[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    subtitle: 'Manage your personal details',
    icon: 'person-outline',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'Manage your notifications',
    icon: 'notifications-outline',
  },
];

const SUPPORT_ITEMS: MenuItem[] = [
  {
    id: 'support',
    title: 'Help & Support',
    subtitle: 'Get help and support',
    icon: 'help-circle-outline',
  },
  {
    id: 'about',
    title: 'About Sagawa',
    subtitle: 'App information and version',
    icon: 'information-circle-outline',
  },
];

const EMPTY_PROFILE: Profile = {
  name: 'Your Profile',
  age: null,
  gender: null,
  location: '',
  profileImage: '',
  profileCompleted: false,
};

const TRACK_WIDTH = 56;
const TRACK_HEIGHT = 30;
const THUMB_SIZE = 24;

function AppearanceSwitch({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const [slide] = useState(() => new Animated.Value(value ? 1 : 0));
  const [colorProgress] = useState(() => new Animated.Value(value ? 1 : 0));

  React.useEffect(() => {
    Animated.timing(slide, {
      toValue: value ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();

    Animated.timing(colorProgress, {
      toValue: value ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [value, slide, colorProgress]);

  const trackColor = colorProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E7E7EC', '#1C1C2A'],
  });

  const thumbTranslate = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [3, TRACK_WIDTH - THUMB_SIZE - 3],
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel="Dark mode"
      accessibilityState={{ checked: value }}
      hitSlop={10}
      style={stylesSwitch.hitArea}
    >
      <Animated.View style={[stylesSwitch.track, { backgroundColor: trackColor }]}>
        <Animated.View
          style={[stylesSwitch.thumb, { transform: [{ translateX: thumbTranslate }] }]}
        >
          <Ionicons
            name={value ? 'moon' : 'sunny'}
            size={13}
            color={value ? '#5B5FE0' : '#F5A623'}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const isDark = theme.isDark;
  const styles = createStyles(theme.colors, isDark);

  const authStatus = useAuthStore((state) => state.status);
  const isGuest = authStatus === 'guest';
  const profileQuery = useProfile();
  const imageUpload = useUploadProfileImage();
  const profile = profileQuery.data ?? EMPTY_PROFILE;
  const loading = !isGuest && profileQuery.isLoading;
  const uploadingImage = imageUpload.isPending;
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const [profileImageHeaders, setProfileImageHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isGuest) {
      return;
    }

    let active = true;
    void getStoredTokens().then((tokens) => {
      if (active && tokens?.accessToken) {
        setProfileImageHeaders({ Authorization: `Bearer ${tokens.accessToken}` });
      }
    });
    return () => {
      active = false;
    };
  }, [isGuest, profile.profileImage]);

  const profileImageRequestHeaders = isGuest ? undefined : profileImageHeaders;

  const toggleTheme = () => {
    useSettingsStore.setState({
      themePreference: isDark ? 'light' : 'dark',
    });
  };

  const uploadProfileImage = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      const fileType = asset.mimeType?.toLowerCase().startsWith('image/')
        ? asset.mimeType.toLowerCase()
        : 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(fileType)) {
        throw new ApiError('Choose a JPEG, PNG, or WebP image.', { status: 400 });
      }
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        throw new ApiError('Profile image must be 5 MB or smaller.', { status: 413 });
      }
      const extension =
        fileType === 'image/png' ? 'png' : fileType === 'image/webp' ? 'webp' : 'jpg';
      const fileName = `profile.${extension}`;

      const formData = new FormData();
      const file = Platform.OS === 'web' ? asset.file : new ExpoFile(asset.uri);

      if (!file) {
        throw new ApiError('The selected image could not be read.', { status: 400 });
      }

      formData.append('image', file, fileName);

      await imageUpload.mutateAsync(formData);
      setProfileImageFailed(false);
    } catch (error) {
      console.error('Profile image upload error:', error);
      Alert.alert(
        'Upload Failed',
        error instanceof ApiError
          ? error.message
          : 'Unable to upload your profile image. Please try again.',
      );
    }
  };

  const selectProfileImage = async () => {
    if (isGuest) {
      Alert.alert('Sign In Required', 'Create an account or sign in to add a profile picture.');
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to select a profile picture.',
        );

        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      await uploadProfileImage(result.assets[0]);
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Image Error', 'Unable to select this image.');
    }
  };

  const handleNotificationsPress = async () => {
    try {
      const result = await registerPushToken();

      if (result.status === 'registered') {
        Alert.alert(
          'Notifications Enabled',
          'You will now receive push notifications from Sagawa.',
        );
        return;
      }

      if (result.status === 'denied') {
        Alert.alert(
          'Notifications Disabled',
          'Notification permission was not granted. You can enable it later from your device settings.',
        );
        return;
      }

      Alert.alert(
        'Notifications Unavailable',
        result.reason === 'expo-go'
          ? 'Android push notifications require a development build or production build, not Expo Go.'
          : 'Push notifications are not available in the web version of Sagawa.',
      );
    } catch (error) {
      console.error('Push notification registration error:', error);
      Alert.alert('Notifications Error', 'Unable to register for push notifications right now.');
    }
  };

  const handleMenuPress = (id: string) => {
    switch (id) {
      case 'personal':
        router.push('/perdonal-information');
        break;

      case 'notifications':
        handleNotificationsPress();
        break;

      case 'support':
        router.push('/help-support');
        break;

      case 'about':
        router.push('/about');
        break;
    }
  };

  const handleLogout = () => {
    if (isGuest) {
      void useAuthStore
        .getState()
        .exitGuest()
        .then(() => {
          router.replace('/login');
        });
      return;
    }

    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await apiRequest('/api/auth/logout', { method: 'POST' });
              } catch {
                // Local logout must still complete if the network is unavailable.
              }
              await useAuthStore.getState().clearSession();
              router.replace('/login');
            })();
          },
        },
      ],
      { cancelable: true },
    );
  };

  const renderSection = (items: MenuItem[]) => (
    <View style={styles.sectionCard}>
      {items.map((item, index) => (
        <View key={item.id}>
          <Pressable
            onPress={() => handleMenuPress(item.id)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            android_ripple={{ color: isDark ? '#2A2A2E' : '#ECECEE' }}
            style={({ pressed }) => [
              styles.menuRow,
              Platform.OS === 'ios' && pressed && styles.pressed,
            ]}
          >
            <View style={styles.iconColumn}>
              <Ionicons name={item.icon} size={21} color={isDark ? '#FFFFFF' : '#111111'} />
            </View>

            <View style={styles.menuText}>
              <Text style={styles.menuTitle} allowFontScaling={false}>
                {item.title}
              </Text>
              <Text style={styles.menuSubtitle} allowFontScaling={false} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={17} color={isDark ? '#636366' : '#A7A7AD'} />
          </Pressable>

          {index < items.length - 1 && <View style={styles.divider} />}
        </View>
      ))}
    </View>
  );

  if (isGuest) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style={theme.statusBarStyle} />
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle} allowFontScaling={false}>
              Profile
            </Text>
            <AppearanceSwitch value={isDark} onValueChange={toggleTheme} />
          </View>

          <View style={styles.guestHero}>
            <View style={styles.guestAvatar}>
              <Ionicons name="person-outline" size={34} color="#FFFFFF" />
            </View>
            <Text style={styles.guestTitle} allowFontScaling={false}>
              Guest mode
            </Text>
            <Text style={styles.guestDescription} allowFontScaling={false}>
              You can read public news, exchange rates, and services without an account. Sign in to
              save and manage personal profile features.
            </Text>

            <View style={styles.guestActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                onPress={() => router.push('/login')}
                style={({ pressed }) => [styles.guestPrimaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.guestPrimaryText}>Sign in</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create account"
                onPress={() => router.push('/signup')}
                style={({ pressed }) => [styles.guestSecondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.guestSecondaryText}>Create account</Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.sectionLabel, styles.supportLabel]} allowFontScaling={false}>
            SUPPORT
          </Text>
          {renderSection(SUPPORT_ITEMS)}

          <Pressable
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Exit guest mode"
            style={({ pressed }) => [styles.logoutRow, pressed && styles.pressed]}
          >
            <Ionicons name="exit-outline" size={21} color="#FF3B30" />
            <Text style={styles.logoutText} allowFontScaling={false}>
              Exit Guest Mode
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={theme.statusBarStyle} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isGuest && profileQuery.isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={theme.statusBarStyle} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Unable to load your profile.</Text>
          <Pressable accessibilityRole="button" onPress={() => void profileQuery.refetch()}>
            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const avatarUri = getMediaUrl(profile.profileImage);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style={theme.statusBarStyle} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle} allowFontScaling={false}>
            Profile
          </Text>

          <AppearanceSwitch value={isDark} onValueChange={toggleTheme} />
        </View>

        <View style={styles.profileHeader}>
          <Pressable
            onPress={selectProfileImage}
            style={styles.avatarPressable}
            disabled={uploadingImage}
          >
            <View style={styles.avatar}>
              {avatarUri && !profileImageFailed ? (
                <Image
                  source={{ uri: avatarUri, headers: profileImageRequestHeaders }}
                  style={styles.avatarImage}
                  onError={() => setProfileImageFailed(true)}
                />
              ) : (
                <Ionicons name="person" size={39} color="#FFFFFF" />
              )}

              {uploadingImage && (
                <View style={styles.avatarUploadingOverlay}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              )}
            </View>

            <View style={styles.editAvatarBadge}>
              <Ionicons name="pencil" size={13} color="#FFFFFF" />
            </View>
          </Pressable>

          <View style={styles.profileText}>
            <Text style={styles.profileName} allowFontScaling={false}>
              {profile.name}
            </Text>
            <Text style={styles.profileSubtitle} allowFontScaling={false}>
              {profile.age ?? 'Age not set'} ·{' '}
              {profile.gender
                ? `${profile.gender[0].toUpperCase()}${profile.gender.slice(1)}`
                : 'Gender not set'}
              {profile.location ? ` · ${profile.location}` : ''}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel} allowFontScaling={false}>
          ACCOUNT
        </Text>

        {renderSection(ACCOUNT_ITEMS)}

        <Text style={[styles.sectionLabel, styles.supportLabel]} allowFontScaling={false}>
          SUPPORT
        </Text>

        {renderSection(SUPPORT_ITEMS)}

        <Pressable
          onPress={handleLogout}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          android_ripple={{ color: 'rgba(255,59,48,0.15)' }}
          style={({ pressed }) => [
            styles.logoutRow,
            Platform.OS === 'ios' && pressed && styles.pressed,
          ]}
        >
          <Ionicons name="log-out-outline" size={21} color="#FF3B30" />
          <Text style={styles.logoutText} allowFontScaling={false}>
            Log Out
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (
  colors: {
    background: string;
    surface: string;
    elevated: string;
    border: string;
    text: string;
    textMuted: string;
    primary: string;
    primarySoft: string;
  },
  isDark: boolean,
) =>
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
      paddingTop: Platform.OS === 'ios' ? 2 : 8,
      paddingBottom: 28,
    },
    header: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 34,
      lineHeight: 40,
      fontWeight: '700',
      letterSpacing: -1.1,
    },
    guestHero: {
      alignItems: 'center',
      marginBottom: 8,
      paddingHorizontal: 18,
      paddingVertical: 24,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    guestAvatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      marginBottom: 14,
    },
    guestTitle: {
      color: colors.text,
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '700',
    },
    guestDescription: {
      marginTop: 8,
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
    },
    guestActions: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      gap: 10,
      marginTop: 20,
    },
    guestPrimaryButton: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    guestPrimaryText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    guestSecondaryButton: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    guestSecondaryText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    profileHeader: {
      minHeight: 78,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 28,
      paddingHorizontal: 2,
    },
    avatarPressable: {
      position: 'relative',
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: isDark ? '#333333' : '#E5E7EB',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 999,
    },
    avatarUploadingOverlay: {
      ...StyleSheet.absoluteFill,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    editAvatarBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.background,
    },
    profileText: {
      flex: 1,
      marginLeft: 16,
    },
    profileName: {
      color: colors.text,
      fontSize: 21,
      lineHeight: 26,
      fontWeight: '700',
      letterSpacing: -0.35,
    },
    profileSubtitle: {
      marginTop: 3,
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    sectionLabel: {
      marginLeft: 12,
      marginBottom: 8,
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      letterSpacing: 0.35,
    },
    supportLabel: {
      marginTop: 24,
    },
    sectionCard: {
      overflow: 'hidden',
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    menuRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.surface,
    },
    pressed: {
      opacity: 0.62,
    },
    iconColumn: {
      width: 38,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    menuText: {
      flex: 1,
      minWidth: 0,
      paddingRight: 10,
    },
    menuTitle: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '600',
    },
    menuSubtitle: {
      marginTop: 1,
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 52,
      backgroundColor: colors.border,
    },
    logoutRow: {
      height: 58,
      marginTop: 20,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,59,48,0.22)' : 'rgba(255,59,48,0.14)',
      overflow: 'hidden',
    },
    logoutText: {
      marginLeft: 8,
      color: '#FF3B30',
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 15,
    },
  });

const stylesSwitch = StyleSheet.create({
  hitArea: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  thumb: {
    position: 'absolute',
    top: 3,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
    }),
  },
});
