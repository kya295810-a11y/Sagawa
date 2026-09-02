import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { apiRequest } from '@/services/api/client';
import { useAppTheme } from '@/theme/provider';
import type { ThemeColors } from '@/theme/types';

type News = { title: string; description: string; date: string; image: string; video: string };
const text = (...values: unknown[]) => values.find((v): v is string => typeof v === 'string' && v.trim().length > 0)?.trim() ?? '';
const media = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const newsId = Array.isArray(id) ? id[0] : id;
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);
  const [article, setArticle] = useState<News | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!newsId) return;
    void apiRequest<unknown>('/api/news').then((payload) => {
      const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
      const items = Array.isArray(root.data) ? root.data : [];
      const raw = items.find((item) => item && typeof item === 'object' && String((item as Record<string, unknown>).id) === newsId);
      if (!raw || typeof raw !== 'object') throw new Error('News not found');
      const item = raw as Record<string, unknown>;
      setArticle({ title: text(item.title), description: text(item.description, item.content), date: text(item.date, item.publishedAt), image: media(item.image ?? item.imageUrl), video: media(item.video ?? item.videoUrl) });
    }).catch((requestError) => { console.error('News detail API error:', requestError); setError('Unable to load this news item.'); }).finally(() => setLoading(false));
  }, [newsId]);

  return <SafeAreaView style={styles.safeArea} edges={['top']}><StatusBar style={theme.statusBarStyle} />
    <View style={styles.topBar}><Pressable onPress={() => router.back()} hitSlop={10}><Text style={styles.backText}>← Back</Text></Pressable></View>
    {newsId && loading ? <View style={styles.state}><ActivityIndicator /><Text style={styles.body}>Loading news...</Text></View> : error || !article ? <View style={styles.state}><Text style={styles.body}>{error || 'News item not found.'}</Text></View> :
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {article.image ? <Image source={{ uri: article.image }} style={styles.image} resizeMode="cover" /> : null}
        {article.video ? <View style={styles.video}><Text style={styles.videoText}>Video available</Text><Text style={styles.body}>{article.video}</Text></View> : null}
        <Text style={styles.title}>{article.title}</Text>
        {article.date ? <Text style={styles.date}>{article.date}</Text> : null}
        <Text style={styles.body}>{article.description || 'No content is available.'}</Text>
      </ScrollView>}
  </SafeAreaView>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, topBar: { paddingHorizontal: 18, paddingVertical: 14 },
  backText: { color: colors.text, fontSize: 17, fontWeight: '600' }, content: { padding: 18, paddingTop: 4, paddingBottom: 40 },
  image: { width: '100%', height: 220, borderRadius: 16, marginBottom: 20, backgroundColor: colors.surface },
  video: { padding: 14, borderRadius: 12, backgroundColor: colors.surface, marginBottom: 20 }, videoText: { color: colors.text, fontWeight: '700', marginBottom: 5 },
  title: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '800', marginBottom: 8 }, date: { color: colors.textMuted, fontSize: 14, marginBottom: 18 },
  body: { color: colors.textSecondary, fontSize: 16, lineHeight: 25 }, state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
});
