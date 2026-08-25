import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
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
  iconColor: string;
  iconBackground: string;
};

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    subtitle: 'Manage your personal details',
    icon: 'person-outline',
    iconColor: '#2563EB',
    iconBackground: '#E8F0FF',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'Manage your notifications',
    icon: 'notifications-outline',
    iconColor: '#F59E0B',
    iconBackground: '#FFF4DE',
  },
  {
    id: 'preferences',
    title: 'App Preferences',
    subtitle: 'Customize your experience',
    icon: 'settings-outline',
    iconColor: '#10B981',
    iconBackground: '#E1F8EE',
  },
  {
    id: 'support',
    title: 'Help & Support',
    subtitle: 'Get help and support',
    icon: 'help-circle-outline',
    iconColor: '#7C3AED',
    iconBackground: '#F0E9FF',
  },
  {
    id: 'about',
    title: 'About Malay MM',
    subtitle: 'App information and version',
    icon: 'information-circle-outline',
    iconColor: '#2563EB',
    iconBackground: '#E8F0FF',
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();

  const themePreference = useSettingsStore(
    (state) => state.themePreference,
  );

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

      case 'preferences':
        Alert.alert(
          'App Preferences',
          'Use the light and dark mode switch at the top of this screen to change the app appearance.',
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

      default:
        break;
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => router.replace('/login'),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <StatusBar style={theme.statusBarStyle} />

      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          bounces
        >
          {/* HEADER */}
          <View style={styles.header}>
            <Text
              style={styles.headerTitle}
              allowFontScaling={false}
            >
              Profile
            </Text>

            {/* GLOBAL LIGHT / DARK SWITCH */}
            <View style={styles.themeControl}>
              <Ionicons
                name={isDark ? 'moon' : 'sunny'}
                size={17}
                color={isDark ? '#FFFFFF' : theme.colors.primary}
              />

              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{
                  false: '#D9E2F2',
                  true: '#2563EB',
                }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D9E2F2"
                accessibilityRole="switch"
                accessibilityLabel="Dark mode"
                accessibilityState={{ checked: isDark }}
              />
            </View>
          </View>

          {/* SIMPLE PROFILE HERO */}
          <View style={styles.hero}>
            <View style={styles.heroGlow} />

            <View style={styles.avatarOuter}>
              <View style={styles.avatar}>
                <Ionicons
                  name="person"
                  size={48}
                  color="#FFFFFF"
                />
              </View>
            </View>

            <Text
              style={styles.heroTitle}
              allowFontScaling={false}
            >
              Profile
            </Text>

            <Text
              style={styles.heroSubtitle}
              allowFontScaling={false}
            >
              Manage your account
            </Text>
          </View>

          {/* SETTINGS LIST */}
          <View style={styles.menuCard}>
            {MENU_ITEMS.map((item, index) => {
              const isPreferences = item.id === 'preferences';

              return (
                <View key={item.id}>
                  <Pressable
                    onPress={() => handleMenuPress(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    style={({ pressed }) => [
                      styles.menuRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.menuIcon,
                        {
                          backgroundColor:
                            isDark
                              ? `${item.iconColor}22`
                              : item.iconBackground,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={21}
                        color={item.iconColor}
                      />
                    </View>

                    <View style={styles.menuText}>
                      <Text
                        style={styles.menuTitle}
                        allowFontScaling={false}
                      >
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
                      size={19}
                      color={theme.colors.textMuted}
                    />
                  </Pressable>

                  {index < MENU_ITEMS.length - 1 && (
                    <View style={styles.divider} />
                  )}
                </View>
              );
            })}
          </View>

          {/* LOG OUT */}
          <Pressable
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.logoutPressed,
            ]}
          >
            <Ionicons
              name="log-out-outline"
              size={21}
              color="#EF4444"
            />

            <Text
              style={styles.logoutText}
              allowFontScaling={false}
            >
              Log Out
            </Text>
          </Pressable>

          <Text
            style={styles.footer}
            allowFontScaling={false}
          >
            Malay MM
          </Text>

          <View style={styles.bottomSpace} />
        </ScrollView>
      </View>
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
      paddingTop: 8,
      paddingBottom: 20,
    },

    header: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },

    headerTitle: {
      color: colors.text,
      fontSize: 29,
      lineHeight: 34,
      fontWeight: '900',
      letterSpacing: -0.8,
    },

    themeControl: {
      height: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingLeft: 8,
      paddingRight: 2,
      borderRadius: 20,
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.07)'
        : '#F3F7FC',
      borderWidth: 1,
      borderColor: colors.border,
    },

    hero: {
      minHeight: 224,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: isDark
        ? '#0D1B32'
        : '#F3F8FF',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(74,134,255,0.22)'
        : '#DDE9FA',
      marginBottom: 14,
    },

    heroGlow: {
      position: 'absolute',
      width: 210,
      height: 210,
      borderRadius: 105,
      backgroundColor: isDark
        ? 'rgba(37,99,235,0.13)'
        : 'rgba(37,99,235,0.09)',
      top: -48,
      right: -55,
    },

    avatarOuter: {
      width: 108,
      height: 108,
      borderRadius: 54,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: isDark
        ? '#3B82F6'
        : '#BFD8FF',
      backgroundColor: isDark
        ? '#152B4D'
        : '#E8F1FF',
    },

    avatar: {
      width: 92,
      height: 92,
      borderRadius: 46,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },

    heroTitle: {
      marginTop: 12,
      color: colors.text,
      fontSize: 21,
      lineHeight: 26,
      fontWeight: '900',
      letterSpacing: -0.4,
    },

    heroSubtitle: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '500',
    },

    menuCard: {
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    menuRow: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },

    menuIcon: {
      width: 43,
      height: 43,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    menuText: {
      flex: 1,
      paddingRight: 8,
    },

    menuTitle: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
    },

    menuSubtitle: {
      color: colors.textMuted,
      fontSize: 10.5,
      lineHeight: 15,
      fontWeight: '500',
      marginTop: 1,
    },

    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 69,
    },

    logoutButton: {
      height: 52,
      marginTop: 14,
      borderRadius: 17,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark
        ? 'rgba(239,68,68,0.15)'
        : '#FFF1F1',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(239,68,68,0.28)'
        : '#FFD7D7',
    },

    logoutText: {
      color: '#EF4444',
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '900',
      marginLeft: 7,
    },

    footer: {
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
      marginTop: 16,
      opacity: 0.75,
    },

    pressed: {
      opacity: 0.72,
      transform: [{ scale: 0.99 }],
    },

    logoutPressed: {
      opacity: 0.72,
      transform: [{ scale: 0.985 }],
    },

    bottomSpace: {
      height: 16,
    },
  });