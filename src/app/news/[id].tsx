import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '@/services/api/client';
import { useAppTheme } from '@/theme/provider';
import type { ThemeColors } from '@/theme/types';
import { getMediaUrl } from '@/utils/media';

type NewsArticle = {
  title: string;
  description: string;
  category: string;
  date: string;
  image: string;
};

type ApiNewsItem = Record<string, unknown>;

function textValue(...values: unknown[]) {
  return (
    values
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
      ?.trim() ?? ''
  );
}

function mapNewsArticle(item: ApiNewsItem): NewsArticle {
  return {
    title: textValue(item.title, item.name),
    description: textValue(item.description, item.content, item.body),
    category: textValue(item.category, item.type),
    date: textValue(item.date, item.publishedAt, item.createdAt),
    image: textValue(item.image, item.imageUrl, item.image_url),
  };
}

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const newsId = Array.isArray(id) ? id[0] : id;
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/news');
  }, []);

  const loadArticle = useCallback(
    async (signal?: AbortSignal, isActive: () => boolean = () => true) => {
      if (!newsId) {
        setError(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(false);
      setImageFailed(false);

      try {
        const response = await apiRequest<{ success?: boolean; data?: ApiNewsItem }>(
          `/api/news/${encodeURIComponent(newsId)}`,
          { signal },
        );

        if (!response.success || !response.data) {
          throw new Error('News not found');
        }

        if (isActive()) setArticle(mapNewsArticle(response.data));
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return;
        console.error('News detail API error:', requestError);
        if (isActive()) {
          setArticle(null);
          setError(true);
        }
      } finally {
        if (isActive()) setLoading(false);
      }
    },
    [newsId],
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    queueMicrotask(() => {
      if (active) void loadArticle(controller.signal, () => active);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [loadArticle]);

  const imageUrl = getMediaUrl(article?.image);
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style={theme.statusBarStyle} />
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          hitSlop={10}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>News</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error || !article ? (
        <View style={styles.state}>
          <Text style={styles.errorText}>Unable to load this news</Text>
          <Pressable
            onPress={() => void loadArticle()}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {showImage ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="newspaper-outline" size={42} color={theme.colors.textMuted} />
              <Text style={styles.placeholderText}>Image unavailable</Text>
            </View>
          )}

          <View style={styles.metaRow}>
            {!!article.category && <Text style={styles.category}>{article.category}</Text>}
            {!!article.date && <Text style={styles.date}>{article.date}</Text>}
          </View>
          <Text style={styles.title}>{article.title || 'Untitled news'}</Text>
          <Text style={styles.body}>{article.description || 'No content is available.'}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      minHeight: 58,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: { minWidth: 74, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
    backText: { color: colors.text, fontSize: 16, fontWeight: '600' },
    headerTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
    },
    headerSpacer: { width: 74 },
    content: { padding: 18, paddingBottom: 44 },
    image: {
      width: '100%',
      height: 220,
      borderRadius: 14,
      marginBottom: 20,
      backgroundColor: colors.surface,
    },
    imagePlaceholder: {
      height: 220,
      borderRadius: 14,
      marginBottom: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    placeholderText: { color: colors.textMuted, fontSize: 15, marginTop: 10 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    category: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    date: { color: colors.textMuted, fontSize: 13 },
    title: {
      color: colors.text,
      fontSize: 28,
      lineHeight: 35,
      fontWeight: '800',
      marginBottom: 16,
    },
    body: { color: colors.textSecondary, fontSize: 16, lineHeight: 26 },
    state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
    errorText: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
    retryButton: {
      minHeight: 44,
      paddingHorizontal: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    retryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
