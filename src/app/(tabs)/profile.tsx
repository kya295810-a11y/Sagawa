import React, { useRef, useEffect } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
 
import { useAppTheme } from '@/theme/provider';
import { useSettingsStore } from '@/store/settings-store';
 
type MenuItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};
 
// "App Preferences" removed — appearance is now controlled directly
// by the switch in the header.
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
    title: 'About Malay MM',
    subtitle: 'App information and version',
    icon: 'information-circle-outline',
  },
];
 
/**
 * Premium pill-style appearance switch.
 * - Only ONE icon exists at a time (rendered inside the thumb) — no
 *   separate background-icon layer, so there's no risk of two icons
 *   showing at once (the bug seen on Android with the previous version).
 * - Track color and thumb position are driven by separate Animated
 *   values so each can use the most reliable driver for that property:
 *   translateX uses the native driver (butter-smooth on Android),
 *   backgroundColor uses the JS driver (required, since native driver
 *   can't animate colors) — but color is the only thing on the JS
 *   thread now, which is what makes it settle correctly on Android.
 */
function AppearanceSwitch({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const slide = useRef(new Animated.Value(value ? 1 : 0)).current;
  const colorProgress = useRef(new Animated.Value(value ? 1 : 0)).current;
 
  useEffect(() => {
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
          style={[
            stylesSwitch.thumb,
            { transform: [{ translateX: thumbTranslate }] },
          ]}
        >
          {/* Single icon, swapped on state change — never two at once */}
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
 
const TRACK_WIDTH = 56;
const TRACK_HEIGHT = 30;
const THUMB_SIZE = 24;
 
export default function ProfileScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const isDark = theme.isDark;
  const styles = createStyles(theme.colors, isDark);
 
  const toggleTheme = () => {
    useSettingsStore.setState({
      themePreference: isDark ? 'light' : 'dark',
    });
  };
 
  const handleMenuPress = (id: string) => {
    switch (id) {
      case 'personal':
        Alert.alert(
          'Personal Information',
          'This section is ready for your account details when the user-account system is connected.',
        );
        break;
      case 'notifications':
        Alert.alert(
          'Notifications',
          'Notification settings will be available when notifications are connected.',
        );
        break;
      case 'support':
        Alert.alert(
          'Help & Support',
          'Help and support content will be added in a future update.',
        );
        break;
      case 'about':
        Alert.alert(
          'About Malay MM',
          'Malay MM\n\nA simple, useful mobile app for the Malay MM community.',
        );
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
              <Text
                style={styles.menuSubtitle}
                allowFontScaling={false}
                numberOfLines={1}
              >
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
 
          <AppearanceSwitch
            value={isDark}
            onValueChange={toggleTheme}
          />
        </View>
 
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={39} color="#FFFFFF" />
          </View>
 
          <View style={styles.profileText}>
            <Text style={styles.profileName} allowFontScaling={false}>
              Your Profile
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
 
        <Text
          style={[styles.sectionLabel, styles.supportLabel]}
          allowFontScaling={false}
        >
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
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#333333' : '#E5E7EB',
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
      fontWeight: '400',
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
      letterSpacing: -0.15,
    },
    menuSubtitle: {
      marginTop: 1,
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '400',
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
      borderColor: isDark
        ? 'rgba(255,59,48,0.22)'
        : 'rgba(255,59,48,0.14)',
      overflow: 'hidden',
    },
    logoutText: {
      marginLeft: 8,
      color: '#FF3B30',
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '600',
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
    // Soft shadow on iOS, elevation on Android — this is what keeps it
    // from looking flat/plasticky on Android specifically.
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
 