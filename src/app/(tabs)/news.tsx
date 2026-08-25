import React, { useCallback, useEffect, useState } from 'react';
import { env } from '@/config/env';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useAppTheme } from '@/theme/provider';
import type { ThemeColors } from '@/theme/types';

/* ============================================================
   TYPES
============================================================ */

type NewsType = 'photo' | 'video';

type ApiNewsItem = {
  id: number;
  title: string;
  description: string;
  image: string;
  video: string;
  published: boolean;
  date: string;
};

type NewsItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  time: string;
  image: string;
  video: string;
  type: NewsType;
};

const API_BASE_URL = env.EXPO_PUBLIC_API_URL;


const mapApiNews = (item: ApiNewsItem): NewsItem => ({
  id: String(item.id),
  category: 'Latest',
  title: item.title,
  description: item.description,
  time: item.date,
  image: item.image,
  video: item.video || '',
  type: item.video ? 'video' : 'photo',
});

/* ============================================================
   NEWS SCREEN
   ------------------------------------------------------------
   Content comes from the local Admin API.
   Maximum 10 latest published news items.
============================================================ */

/* ============================================================
   NEWS SCREEN
============================================================ */

export default function NewsScreen() {
  const { width, height } = useWindowDimensions();

  /* ==========================================================
     GLOBAL THEME
     ----------------------------------------------------------
     Uses the same theme provider as Home.
  ========================================================== */

  const { theme } = useAppTheme();

  const styles = createStyles(theme.colors);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadNews = useCallback(async () => {
    try {
      setError('');

      const response = await fetch(
        `${API_BASE_URL}/api/news`
      );

      if (!response.ok) {
        throw new Error(
          `News API returned ${response.status}`
        );
      }

      const result = await response.json();

      if (!result.success || !Array.isArray(result.data)) {
        throw new Error('Invalid news API response.');
      }

      const latestNews = result.data
        .filter(
          (item: ApiNewsItem) => item.published
        )
        .sort(
          (a: ApiNewsItem, b: ApiNewsItem) =>
            b.id - a.id
        )
        .slice(0, 10)
        .map(mapApiNews);

      setNews(latestNews);
    } catch (err) {
      console.error('News API error:', err);

      setError(
        'Unable to load news. Make sure the Local API is running.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

 useEffect(() => {
  const timer = setTimeout(() => {
    void loadNews();
  }, 0);

  return () => {
    clearTimeout(timer);
  };
}, [loadNews]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadNews();
  }, [loadNews]);

  /* ==========================================================
     RESPONSIVE IMAGE HEIGHT
  ========================================================== */

  const imageHeight =
    height <= 700
      ? 112
      : height <= 780
        ? 128
        : 142;

  const horizontalPadding = 18;

  const contentWidth = width - horizontalPadding * 2;

  /* ==========================================================
     NEWS CARD
  ========================================================== */

  const renderNewsCard = ({
    item,
  }: {
    item: NewsItem;
  }) => {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.newsCard,
          pressed && styles.cardPressed,
        ]}
        onPress={() => {}}
      >
        {/* ====================================================
            IMAGE
        ==================================================== */}

        <View
          style={[
            styles.imageContainer,
            {
              height: imageHeight,
            },
          ]}
        >
          <Image
            source={{ uri: item.image }}
            style={styles.newsImage}
            resizeMode="cover"
          />

          <View style={styles.imageOverlay} />

          {/* CATEGORY */}

          <View style={styles.imageCategory}>
            <Text
              style={styles.imageCategoryText}
              allowFontScaling={false}
              numberOfLines={1}
            >
              {item.category}
            </Text>
          </View>

          {/* VIDEO */}

          {item.type === 'video' && (
            <View style={styles.videoButton}>
              <Ionicons
                name="play"
                size={16}
                color="#FFFFFF"
              />
            </View>
          )}

          {/* BOOKMARK */}

          <Pressable
            style={styles.imageBookmark}
            hitSlop={8}
            onPress={() => {}}
          >
            <Ionicons
              name="bookmark-outline"
              size={18}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        {/* ====================================================
            CONTENT
        ==================================================== */}

        <View style={styles.newsContent}>
          <Text
            style={styles.newsTitle}
            numberOfLines={3}
            ellipsizeMode="tail"
            allowFontScaling={false}
          >
            {item.title}
          </Text>

          {/* META */}

          <View style={styles.metaRow}>
            <View style={styles.timeContainer}>
              <Ionicons
                name="time-outline"
                size={12}
                color={theme.colors.textMuted}
              />

              <Text
                style={styles.time}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {item.time}
              </Text>
            </View>

            {item.type === 'video' && (
              <View style={styles.videoLabel}>
                <Ionicons
                  name="videocam-outline"
                  size={12}
                  color={theme.colors.primary}
                />

                <Text
                  style={styles.videoLabelText}
                  allowFontScaling={false}
                >
                  Video
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  /* ==========================================================
     SCREEN
  ========================================================== */

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      {/* GLOBAL STATUS BAR */}

      <StatusBar style={theme.statusBarStyle} />

      <View style={styles.container}>
        {/* ====================================================
            HEADER
        ==================================================== */}

        <View style={styles.header}>
          <Text
            style={styles.title}
            allowFontScaling={false}
          >
            News
          </Text>

          <View style={styles.headerActions}>
            {/* SEARCH */}

            <Pressable
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={6}
              onPress={() => {}}
            >
              <Ionicons
                name="search-outline"
                size={21}
                color={theme.colors.text}
              />
            </Pressable>

            {/* NOTIFICATION */}

            <Pressable
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={6}
              onPress={() => {}}
            >
              <Ionicons
                name="notifications-outline"
                size={21}
                color={theme.colors.text}
              />

              <View style={styles.notificationDot} />
            </Pressable>
          </View>
        </View>

        {/* ====================================================
            ALL NEWS HEADER
        ==================================================== */}

        <View style={styles.sectionHeader}>
          <Text
            style={styles.sectionTitle}
            allowFontScaling={false}
          >
            All News
          </Text>

          <Text
            style={styles.latestText}
            allowFontScaling={false}
          >
            Latest
          </Text>
        </View>

        {/* ====================================================
            NEWS LIST
        ==================================================== */}

        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
            />
            <Text style={styles.stateText}>
              Loading latest news...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateTitle}>
              News unavailable
            </Text>
            <Text style={styles.stateText}>
              {error}
            </Text>

            <Pressable
              onPress={loadNews}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : news.length === 0 ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateTitle}>
              No published news
            </Text>
            <Text style={styles.stateText}>
              Publish a news item from the Admin dashboard.
            </Text>
          </View>
        ) : null}

        <FlatList
          data={news}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={renderNewsCard}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          directionalLockEnabled
          bounces
          nestedScrollEnabled
          contentContainerStyle={[
            styles.listContent,
            {
              width: contentWidth,
            },
          ]}
        />
      </View>
    </SafeAreaView>
  );
}

/* ============================================================
   STYLES
   ------------------------------------------------------------
   All light/dark colors come from ThemeColors.
============================================================ */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /* ========================================================
       SCREEN
    ======================================================== */

    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },

    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 18,
    },

    /* ========================================================
       HEADER
    ======================================================== */

    header: {
      height: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 3,
      marginBottom: 8,
    },

    title: {
      color: colors.text,
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '800',
      letterSpacing: -0.9,
      includeFontPadding: false,
    },

    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },

    headerButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },

    buttonPressed: {
      opacity: 0.7,
      transform: [
        {
          scale: 0.94,
        },
      ],
    },

    notificationDot: {
      position: 'absolute',
      top: 9,
      right: 10,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },

    /* ========================================================
       SECTION HEADER
    ======================================================== */

    sectionHeader: {
      height: 35,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 7,
    },

    sectionTitle: {
      color: colors.text,
      fontSize: 21,
      lineHeight: 27,
      fontWeight: '700',
      letterSpacing: -0.35,
      includeFontPadding: false,
    },

    latestText: {
      color: colors.primary,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '700',
      includeFontPadding: false,
    },

    /* ========================================================
       LIST
    ======================================================== */

    listContent: {
      paddingTop: 1,
      paddingBottom: 14,
    },

    /* ========================================================
       NEWS CARD
    ======================================================== */

    newsCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: 11,

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.065,
      shadowRadius: 10,
      elevation: 2,
    },

    /* ========================================================
       IMAGE
    ======================================================== */

    imageContainer: {
      width: '100%',
      backgroundColor: colors.surface,
      position: 'relative',
      overflow: 'hidden',
    },

    newsImage: {
      width: '100%',
      height: '100%',
    },

    imageOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 70,
      backgroundColor: 'rgba(0,0,0,0.18)',
    },

    /* ========================================================
       CATEGORY
    ======================================================== */

    imageCategory: {
      position: 'absolute',
      left: 12,
      bottom: 11,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.94)',
    },

    imageCategoryText: {
      color: '#087CFF',
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
      includeFontPadding: false,
    },

    /* ========================================================
       VIDEO BUTTON
    ======================================================== */

    videoButton: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 48,
      height: 48,
      marginLeft: -24,
      marginTop: -24,
      borderRadius: 24,
      backgroundColor: 'rgba(10,23,42,0.82)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: 2,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
    },

    /* ========================================================
       BOOKMARK
    ======================================================== */

    imageBookmark: {
      position: 'absolute',
      top: 11,
      right: 11,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(10,23,42,0.48)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
    },

    /* ========================================================
       CONTENT
    ======================================================== */

    stateContainer: {
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 30,
    },

    stateTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },

    stateText: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    retryButton: {
      marginTop: 14,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },

    retryText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },

    newsContent: {
      paddingHorizontal: 14,
      paddingTop: 11,
      paddingBottom: 11,
    },

    newsTitle: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '700',
      letterSpacing: -0.15,
      includeFontPadding: false,
    },

    /* ========================================================
       META
    ======================================================== */

    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      minHeight: 17,
    },

    timeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    time: {
      color: colors.textMuted,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '500',
      marginLeft: 4,
      includeFontPadding: false,
    },

    videoLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 10,
      paddingLeft: 10,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    },

    videoLabelText: {
      color: colors.primary,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '600',
      marginLeft: 4,
      includeFontPadding: false,
    },

    /* ========================================================
       PRESSED CARD
    ======================================================== */

    cardPressed: {
      opacity: 0.75,
      transform: [
        {
          scale: 0.99,
        },
      ],
    },
  });