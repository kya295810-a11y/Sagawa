import React, { useCallback, useState } from 'react';
import { env } from '@/config/env';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAppTheme } from '@/theme/provider';
import { useSettingsStore } from '@/store/settings-store';
import type { ThemeColors } from '@/theme/types';

/* =============================================================
   KUALA LUMPUR IMAGES
============================================================= */

const KL_DAY = require('../../../assets/images/kl-day.png');
const KL_NIGHT = require('../../../assets/images/kl-night.png');


const API_BASE_URL = env.EXPO_PUBLIC_API_URL;

type NewsItem = {
  id: number | string;
  title: string;
  description?: string;
  image?: string;
  video?: string;
  published?: boolean;
  date?: string;
};

type ExchangeResponse = {
  success: boolean;
  data?: {
    rate?: string | number;
    updatedAt?: string;
  };
};

/* =============================================================
   HOME SCREEN
============================================================= */

export default function HomeScreen() {
  const router = useRouter();

  const { theme } = useAppTheme();

  /*
   * Read the current global theme preference.
   *
   * The actual resolved light/dark state comes from
   * AppThemeProvider through theme.isDark.
   */
  const themePreference = useSettingsStore(
    (state) => state.themePreference,
  );

  const userName = 'Kyaw San Lin';

  const styles = createStyles(theme.colors);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<string>('1000');
  const [exchangeUpdatedAt, setExchangeUpdatedAt] = useState<string>('');

  const loadLatestNews = useCallback(async () => {
    try {
      setNewsError(false);

      const response = await fetch(`${API_BASE_URL}/api/news`);

      if (!response.ok) {
        throw new Error(`News API returned ${response.status}`);
      }

      const payload: unknown = await response.json();

      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('success' in payload) ||
        !('data' in payload)
      ) {
        throw new Error('Invalid news API response');
      }

      const data = (payload as { data: unknown }).data;

      if (!Array.isArray(data)) {
        throw new Error('News API data is not an array');
      }

      const latest = data
        .filter((item): item is NewsItem => {
          if (typeof item !== 'object' || item === null) return false;
          const value = item as Record<string, unknown>;
          return (
            (typeof value.id === 'number' || typeof value.id === 'string') &&
            typeof value.title === 'string'
          );
        })
        .filter((item) => item.published !== false)
        .slice(0, 2);

      setNews(latest);
    } catch (error) {
      console.error('Home news API error:', error);
      setNewsError(true);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  const loadExchangeRate = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/exchange-rate`);

      if (!response.ok) {
        throw new Error(`Exchange API returned ${response.status}`);
      }

      const payload: ExchangeResponse = await response.json();

      if (!payload.success || payload.data?.rate == null) {
        throw new Error('Invalid exchange API response');
      }

      setExchangeRate(String(payload.data.rate));
      setExchangeUpdatedAt(payload.data.updatedAt ?? '');
    } catch (error) {
      console.error('Home exchange API error:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLatestNews();
    }, [loadLatestNews]),
  );

  useFocusEffect(
    useCallback(() => {
      loadExchangeRate();
    }, [loadExchangeRate]),
  );

  const formatNewsDate = (value?: string) => {
    if (!value) return 'Latest';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  /* ===========================================================
     GLOBAL THEME TOGGLE
  =========================================================== */

  const toggleTheme = () => {
    /*
     * We intentionally set an explicit preference instead
     * of maintaining a separate local isDark state.
     *
     * This means:
     *
     * Home
     *   ↓
     * settings-store
     *   ↓
     * AppThemeProvider
     *   ↓
     * theme
     *   ↓
     * News / Exchange / Services / Profile
     */

    useSettingsStore.setState({
      themePreference: theme.isDark ? 'light' : 'dark',
    });
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <StatusBar
        style={theme.statusBarStyle}
      />

      <View style={styles.container}>

        {/* =====================================================
            MAIN SCROLL
        ===================================================== */}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          bounces={true}
          alwaysBounceVertical={true}
          nestedScrollEnabled={true}
          directionalLockEnabled={true}
          keyboardShouldPersistTaps="handled"
        >

          {/* ===================================================
              WELCOME
          =================================================== */}

          <View style={styles.header}>

            <View style={styles.welcomeContainer}>

              <Text
                style={styles.welcome}
                allowFontScaling={false}
              >
                Welcome
              </Text>

              <Text
                style={styles.userName}
                allowFontScaling={false}
              >
                {userName}
              </Text>

            </View>

            {/* =================================================
                LIGHT / DARK BUTTON
            ================================================= */}

            <Pressable
              onPress={toggleTheme}
              accessibilityRole="button"
              accessibilityLabel={
                theme.isDark
                  ? 'Switch to light mode'
                  : 'Switch to dark mode'
              }
              style={({ pressed }) => [
                styles.themeButton,
                pressed && styles.pressed,
              ]}
            >

              <Ionicons
                name={
                  theme.isDark
                    ? 'moon'
                    : 'sunny'
                }
                size={19}
                color={
                  theme.isDark
                    ? '#FFFFFF'
                    : theme.colors.text
                }
              />

            </Pressable>

          </View>

          {/* ===================================================
              KUALA LUMPUR
          =================================================== */}

          <ImageBackground
            source={
              theme.isDark
                ? KL_NIGHT
                : KL_DAY
            }
            style={styles.locationCard}
            imageStyle={styles.locationImage}
            resizeMode="cover"
          >

            {/* PHOTO OVERLAY */}

            <View
              style={[
                styles.locationOverlay,
                theme.isDark &&
                  styles.locationOverlayDark,
              ]}
            >

              {/* LOCATION TEXT */}

              <View style={styles.locationText}>

                <Text
                  style={styles.locationTitle}
                  allowFontScaling={false}
                >
                  Kuala Lumpur
                </Text>

                <Text
                  style={styles.locationSubtitle}
                  allowFontScaling={false}
                >
                  Malaysia 🇲🇾
                </Text>

              </View>

            </View>

          </ImageBackground>

          {/* ===================================================
              EXCHANGE RATE HEADER
          =================================================== */}

          <View style={styles.sectionHeader}>

            <Text
              style={styles.sectionTitle}
              allowFontScaling={false}
            >
              Exchange Rate
            </Text>

            <Pressable
              onPress={() => router.push('/exchange')}
              hitSlop={10}
            >

              <Text
                style={styles.seeAll}
                allowFontScaling={false}
              >
                See All
              </Text>

            </Pressable>

          </View>

          {/* ===================================================
              EXCHANGE RATE CARD
          =================================================== */}

          <Pressable
            onPress={() => router.push('/exchange')}
            style={({ pressed }) => [
              styles.exchangeCard,
              pressed && styles.cardPressed,
            ]}
          >

            {/* CURRENCY ROW */}

            <View style={styles.currencyRow}>

              {/* MYR */}

              <View style={styles.currencySide}>

                <Text
                  style={styles.flag}
                  allowFontScaling={false}
                >
                  🇲🇾
                </Text>

                <View>

                  <Text
                    style={styles.currencyCode}
                    allowFontScaling={false}
                  >
                    MYR
                  </Text>

                  <Text
                    style={styles.currencyName}
                    allowFontScaling={false}
                  >
                    Malaysian Ringgit
                  </Text>

                </View>

              </View>

              {/* ARROW */}

              <Text
                style={styles.exchangeArrow}
                allowFontScaling={false}
              >
                →
              </Text>

              {/* MMK */}

              <View style={styles.currencySide}>

                <Text
                  style={styles.flag}
                  allowFontScaling={false}
                >
                  🇲🇲
                </Text>

                <View>

                  <Text
                    style={styles.currencyCode}
                    allowFontScaling={false}
                  >
                    MMK
                  </Text>

                  <Text
                    style={styles.currencyName}
                    allowFontScaling={false}
                  >
                    Myanmar Kyat
                  </Text>

                </View>

              </View>

            </View>

            {/* DIVIDER */}

            <View style={styles.divider} />

            {/* RATE */}

            <View style={styles.rateRow}>

              <Text
                style={styles.rate}
                allowFontScaling={false}
              >
                1 RM
              </Text>

              <Text
                style={styles.equal}
                allowFontScaling={false}
              >
                =
              </Text>

              <Text
                style={styles.rate}
                allowFontScaling={false}
              >
                {Number(exchangeRate).toLocaleString('en-US')} MMK
              </Text>

            </View>

            <Text
              style={styles.updated}
              allowFontScaling={false}
            >
              Last updated:{' '}
              {exchangeUpdatedAt
                ? new Date(exchangeUpdatedAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '—'}
            </Text>

          </Pressable>

          {/* ===================================================
              LATEST NEWS
          =================================================== */}

          <View
            style={[
              styles.sectionHeader,
              styles.newsHeader,
            ]}
          >
            <Text
              style={styles.sectionTitle}
              allowFontScaling={false}
            >
              Latest News
            </Text>

            <Pressable
              onPress={() => router.push('/news')}
              hitSlop={10}
            >
              <Text
                style={styles.seeAll}
                allowFontScaling={false}
              >
                See All
              </Text>
            </Pressable>
          </View>

          {newsLoading ? (
            <View style={styles.newsStateCard}>
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
              />
              <Text
                style={styles.newsStateText}
                allowFontScaling={false}
              >
                Loading latest news...
              </Text>
            </View>
          ) : newsError ? (
            <Pressable
              onPress={loadLatestNews}
              style={({ pressed }) => [
                styles.newsStateCard,
                pressed && styles.cardPressed,
              ]}
            >
              <Ionicons
                name="cloud-offline-outline"
                size={22}
                color={theme.colors.textMuted}
              />
              <Text
                style={styles.newsStateText}
                allowFontScaling={false}
              >
                Unable to load news. Tap to retry.
              </Text>
            </Pressable>
          ) : news.length === 0 ? (
            <View style={styles.newsStateCard}>
              <Ionicons
                name="newspaper-outline"
                size={22}
                color={theme.colors.textMuted}
              />
              <Text
                style={styles.newsStateText}
                allowFontScaling={false}
              >
                No published news yet.
              </Text>
            </View>
          ) : (
            news.map((item) => (
              <Pressable
                key={String(item.id)}
                onPress={() => router.push('/news')}
                style={({ pressed }) => [
                  styles.newsCard,
                  pressed && styles.cardPressed,
                ]}
              >
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.newsImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.newsIconBox}>
                    <Ionicons
                      name="newspaper"
                      size={21}
                      color={theme.colors.primary}
                    />
                  </View>
                )}

                <View style={styles.newsContent}>
                  <Text
                    style={styles.newsCategory}
                    allowFontScaling={false}
                  >
                    Malaysia
                  </Text>

                  <Text
                    style={styles.newsTitle}
                    numberOfLines={2}
                    allowFontScaling={false}
                  >
                    {item.title}
                  </Text>

                  <Text
                    style={styles.newsTime}
                    allowFontScaling={false}
                  >
                    {formatNewsDate(item.date)}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={theme.colors.textMuted}
                />
              </Pressable>
            ))
          )}

          {/* ===================================================
              BOTTOM SPACE
          =================================================== */}

          <View style={styles.bottomSpace} />

        </ScrollView>

      </View>
    </SafeAreaView>
  );
}

/* =============================================================
   STYLES
============================================================= */

const createStyles = (
  colors: ThemeColors,
) =>
  StyleSheet.create({

    /* =========================================================
       ROOT
    ========================================================= */

    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },

    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 100,
      flexGrow: 1,
    },

    /* =========================================================
       HEADER
    ========================================================= */

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 22,
    },

    welcomeContainer: {
      flex: 1,
      paddingRight: 12,
    },

    welcome: {
      color: colors.text,

      fontSize: 21,
      lineHeight: 27,

      fontWeight: '700',

      letterSpacing: -0.3,

      includeFontPadding: false,
    },

    userName: {
      color: colors.text,

      fontSize: 16,
      lineHeight: 22,

      fontWeight: '500',

      marginTop: 3,

      includeFontPadding: false,
    },

    /* =========================================================
       LIGHT / DARK BUTTON
    ========================================================= */

    themeButton: {
      width: 44,
      height: 44,

      borderRadius: 22,

      backgroundColor: colors.surface,

      borderWidth: 1,
      borderColor: colors.border,

      alignItems: 'center',
      justifyContent: 'center',

      shadowColor: '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity: 0.08,
      shadowRadius: 5,

      elevation: 3,
    },

    pressed: {
      opacity: 0.7,

      transform: [
        {
          scale: 0.94,
        },
      ],
    },

    /* =========================================================
       KUALA LUMPUR CARD
    ========================================================= */

    locationCard: {
      height: 175,

      borderRadius: 22,

      overflow: 'hidden',

      marginBottom: 34,

      borderWidth: 1,

      borderColor: colors.border,

      backgroundColor: colors.surface,
    },

    locationImage: {
      borderRadius: 22,

      width: '100%',
      height: '125%',

      position: 'absolute',

      top: 0,
      left: 0,
    },

    /* =========================================================
       PHOTO OVERLAY
    ========================================================= */

    locationOverlay: {
      flex: 1,

      backgroundColor:
        'rgba(13, 37, 78, 0.08)',
    },

    locationOverlayDark: {
      backgroundColor:
        'rgba(3, 12, 30, 0.34)',
    },

    /* =========================================================
       LOCATION TEXT
    ========================================================= */

    locationText: {
      position: 'absolute',

      left: 18,

      bottom: 17,
    },

    locationTitle: {
      color: '#FFFFFF',

      fontSize: 21,
      lineHeight: 26,

      fontWeight: '700',

      textShadowColor:
        'rgba(0, 0, 0, 0.55)',

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 4,

      includeFontPadding: false,
    },

    locationSubtitle: {
      color: '#F1F5F9',

      fontSize: 15,
      lineHeight: 21,

      marginTop: 1,

      textShadowColor:
        'rgba(0, 0, 0, 0.55)',

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 4,

      includeFontPadding: false,
    },

    /* =========================================================
       SECTION HEADER
    ========================================================= */

    sectionHeader: {
      flexDirection: 'row',

      alignItems: 'center',

      justifyContent: 'space-between',

      marginBottom: 13,
    },

    sectionTitle: {
      color: colors.text,

      fontSize: 20,
      lineHeight: 26,

      fontWeight: '700',

      letterSpacing: -0.25,

      includeFontPadding: false,
    },

    seeAll: {
      color: colors.primary,

      fontSize: 14,
      lineHeight: 18,

      fontWeight: '600',

      includeFontPadding: false,
    },

    /* =========================================================
       EXCHANGE CARD
    ========================================================= */

    exchangeCard: {
      backgroundColor: colors.surface,

      borderRadius: 19,

      borderWidth: 1,

      borderColor: colors.border,

      paddingHorizontal: 17,

      paddingTop: 17,

      paddingBottom: 16,

      marginBottom: 27,
    },

    currencyRow: {
      flexDirection: 'row',

      alignItems: 'center',

      justifyContent: 'space-between',
    },

    currencySide: {
      flex: 1,

      flexDirection: 'row',

      alignItems: 'center',
    },

    flag: {
      fontSize: 24,

      lineHeight: 28,

      marginRight: 10,

      includeFontPadding: false,
    },

    currencyCode: {
      color: colors.text,

      fontSize: 17,

      lineHeight: 21,

      fontWeight: '700',

      includeFontPadding: false,
    },

    currencyName: {
      color: colors.textMuted,

      fontSize: 11,

      lineHeight: 16,

      marginTop: 1,

      includeFontPadding: false,
    },

    exchangeArrow: {
      color: colors.text,

      fontSize: 28,

      lineHeight: 32,

      fontWeight: '400',

      marginHorizontal: 7,

      includeFontPadding: false,
    },

    divider: {
      height: 1,

      backgroundColor: colors.border,

      marginTop: 16,

      marginBottom: 13,
    },

    rateRow: {
      flexDirection: 'row',

      alignItems: 'center',

      justifyContent: 'center',
    },

    rate: {
      color: colors.text,

      fontSize: 29,

      lineHeight: 35,

      fontWeight: '700',

      letterSpacing: -0.6,

      includeFontPadding: false,
    },

    equal: {
      color: colors.textMuted,

      fontSize: 25,

      lineHeight: 30,

      marginHorizontal: 9,

      fontWeight: '500',

      includeFontPadding: false,
    },

    updated: {
      color: colors.textMuted,

      textAlign: 'center',

      fontSize: 11,

      lineHeight: 15,

      marginTop: 7,

      includeFontPadding: false,
    },

    /* =========================================================
       NEWS
    ========================================================= */

    newsHeader: {
      marginBottom: 13,
    },

    newsCard: {
      flexDirection: 'row',

      alignItems: 'center',

      backgroundColor: colors.surface,

      borderRadius: 18,

      borderWidth: 1,

      borderColor: colors.border,

      minHeight: 92,

      paddingHorizontal: 11,

      paddingVertical: 11,

      marginBottom: 11,
    },

    newsImage: {
      width: 72,
      height: 70,
      borderRadius: 14,
      marginRight: 12,
      backgroundColor: colors.primarySoft,
    },

    newsStateCard: {
      minHeight: 92,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      marginBottom: 11,
    },

    newsStateText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '500',
      marginTop: 7,
      textAlign: 'center',
      includeFontPadding: false,
    },

    newsIconBox: {
      width: 52,
      height: 52,

      borderRadius: 15,

      backgroundColor: colors.primarySoft,

      alignItems: 'center',
      justifyContent: 'center',

      marginRight: 12,
    },

    newsContent: {
      flex: 1,

      paddingRight: 8,
    },

    newsCategory: {
      color: colors.primary,

      fontSize: 11,
      lineHeight: 15,

      fontWeight: '700',

      marginBottom: 2,

      includeFontPadding: false,
    },

    newsTitle: {
      color: colors.text,

      fontSize: 14,
      lineHeight: 18,

      fontWeight: '600',

      includeFontPadding: false,
    },

    newsTime: {
      color: colors.textMuted,

      fontSize: 10,
      lineHeight: 14,

      marginTop: 4,

      includeFontPadding: false,
    },

    /* =========================================================
       PRESSED CARD
    ========================================================= */

    cardPressed: {
      opacity: 0.75,

      transform: [
        {
          scale: 0.99,
        },
      ],
    },

    /* =========================================================
       BOTTOM SPACE
    ========================================================= */

    bottomSpace: {
      height: 70,
    },
  });