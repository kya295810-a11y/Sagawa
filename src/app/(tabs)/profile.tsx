import React, { useCallback, useState } from 'react';
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

import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { useAppTheme } from '@/theme/provider';
import { useSettingsStore } from '@/store/settings-store';
import { apiRequest } from '@/services/api/client';
import { ApiError } from '@/services/api/errors';
import { getMediaUrl } from '@/utils/media';
import { registerPushToken } from '@/services/notifications/push-token';
import { ApiResponse, Profile } from '@/types/profile';

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
  phoneNumber: '',
  address: '',
  profileImage: '',
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
  const [slide] = useState(
    () => new Animated.Value(value ? 1 : 0),
  );
  const [colorProgress] = useState(
    () =>
      new Animated.Value(
        value ? 1 : 0,
      ),
  );

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

  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  const toggleTheme = () => {
    useSettingsStore.setState({
      themePreference: isDark ? 'light' : 'dark',
    });
  };

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);

      const response = await apiRequest<ApiResponse<Profile>>('/api/profile');

      setProfile(response.data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setProfile(EMPTY_PROFILE);
        return;
      }

      console.error('Profile load error:', error);
      setProfile(EMPTY_PROFILE);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const uploadProfileImage = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setUploadingImage(true);

      const fileName = asset.fileName ?? `profile-${Date.now()}.jpg`;
      const fileType = asset.mimeType ?? 'image/jpeg';

      const formData = new FormData();
      formData.append('image', {
        uri: asset.uri,
        name: fileName,
        type: fileType,
      } as unknown as Blob);

      const response = await apiRequest<ApiResponse<Profile>>('/api/profile/image', {
        method: 'POST',
        body: formData,
      });

      setProfile(response.data);
    } catch (error) {
      console.error('Profile image upload error:', error);
      Alert.alert('Upload Failed', 'Unable to upload your profile image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const selectProfileImage = async () => {
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
        Alert.alert('Notifications Enabled', 'You will now receive push notifications from Sagawa.');
        return;
      }

      if (result.status === 'denied') {
        Alert.alert(
          'Notifications Disabled',
          'Notification permission was not granted. You can enable it later from your device settings.',
        );
        return;
      }

      Alert.alert('Notifications Unavailable', 'Push notifications require a physical device.');
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
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => router.replace('/login'),
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
              <Ionicons
                name={item.icon}
                size={21}
                color={isDark ? '#FFFFFF' : '#111111'}
              />
            </View>

            <View style={styles.menuText}>
              <Text style={styles.menuTitle} allowFontScaling={false}>
                {item.title}
              </Text>
              <Text style={styles.menuSubtitle} allowFontScaling={false} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={17}
              color={isDark ? '#636366' : '#A7A7AD'}
            />
          </Pressable>

          {index < items.length - 1 && <View style={styles.divider} />}
        </View>
      ))}
    </View>
  );

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
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
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
              Manage your account
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
