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

import { MediaViewer } from '@/components/media/media-viewer';
import { apiRequest } from '@/services/api/client';
import { useAppTheme } from '@/theme/provider';
import type { ThemeColors } from '@/theme/types';
import { getMediaUrl } from '@/utils/media';

type Service = {
  title: string;
  description: string;
  details: string;
  image: string;
  contact: string;
  location: string;
  openingHours: string;
  website: string;
};

const text = (...values: unknown[]) =>
  values
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
    ?.trim() ?? '';

const image = (value: unknown) =>
  typeof value === 'string'
    ? value.trim()
    : value && typeof value === 'object'
      ? text(
          (value as Record<string, unknown>).url,
          (value as Record<string, unknown>).uri,
          (value as Record<string, unknown>).path,
        )
      : '';

function parseService(payload: unknown, id: string): Service | null {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const data = root.data ?? root.services ?? root.items ?? root.results;
  const items = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? Object.values(data as Record<string, unknown>)
      : [];
  const value = items.find(
    (item) =>
      item &&
      typeof item === 'object' &&
      String((item as Record<string, unknown>).id ?? (item as Record<string, unknown>)._id) === id,
  );
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  return {
    title: text(item.title, item.name, item.serviceName),
    description: text(item.description, item.summary, item.excerpt),
    details: text(item.details, item.detail, item.content),
    image: image(
      item.image ?? item.imageUrl ?? item.image_url ?? item.imageName ?? item.photo ?? item.media,
    ),
    contact: text(item.contact, item.phone, item.email),
    location: text(item.location, item.address),
    openingHours: text(item.openingHours, item.opening_hours),
    website: text(item.website, item.url, item.link),
  };
}

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const serviceId = Array.isArray(id) ? id[0] : id;
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewerSource, setViewerSource] = useState<{ source: string; title: string } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/services');
  }, []);

  useEffect(() => {
    if (!serviceId) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    void apiRequest<unknown>('/api/services', { signal: controller.signal })
      .then((payload) => {
        const result = parseService(payload, serviceId);
        if (!result?.title) throw new Error('Service not found');
        if (active) {
          setService(result);
          setImageFailed(false);
        }
      })
      .catch((requestError) => {
        if (requestError instanceof Error && requestError.name === 'AbortError') return;
        console.error('Service detail API error:', requestError);
        if (active) setError('Unable to load this service.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [serviceId]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style={theme.statusBarStyle} />
      <View style={styles.topBar}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>
      {serviceId && loading ? (
        <State text="Loading service..." styles={styles} />
      ) : error || !service ? (
        <State text={error || 'Service not found.'} styles={styles} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {getMediaUrl(service.image) && !imageFailed ? (
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                setViewerSource({ source: service.image, title: service.title });
              }}
            >
              <Image
                source={{ uri: getMediaUrl(service.image) }}
                style={styles.image}
                resizeMode="cover"
                onError={() => setImageFailed(true)}
              />
            </Pressable>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.body}>Image unavailable</Text>
            </View>
          )}
          <Text style={styles.title}>{service.title}</Text>
          <Text style={styles.body}>
            {service.description || service.details || 'No description is available.'}
          </Text>
          {service.details && service.details !== service.description ? (
            <Text style={styles.body}>{service.details}</Text>
          ) : null}
          {[
            ['Contact', service.contact],
            ['Location', service.location],
            ['Opening hours', service.openingHours],
            ['Website', service.website],
          ].map(([label, value]) =>
            value ? (
              <View style={styles.info} key={label}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.body}>{value}</Text>
              </View>
            ) : null,
          )}
        </ScrollView>
      )}
      <MediaViewer
        visible={viewerSource !== null}
        type="image"
        source={viewerSource?.source}
        title={viewerSource?.title}
        onClose={() => setViewerSource(null)}
      />
    </SafeAreaView>
  );
}

function State({
  text: message,
  styles,
}: {
  text: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.state}>
      <ActivityIndicator />
      <Text style={styles.body}>{message}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    topBar: { paddingHorizontal: 18, paddingVertical: 14 },
    back: { alignSelf: 'flex-start', paddingVertical: 8 },
    backText: { color: colors.text, fontSize: 17, fontWeight: '600' },
    content: { padding: 18, paddingTop: 4, paddingBottom: 40 },
    image: {
      width: '100%',
      height: 220,
      borderRadius: 16,
      marginBottom: 22,
      backgroundColor: colors.surface,
    },
    imagePlaceholder: {
      height: 220,
      borderRadius: 16,
      marginBottom: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    title: {
      color: colors.text,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
      marginBottom: 14,
    },
    body: { color: colors.textSecondary, fontSize: 16, lineHeight: 25 },
    info: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 22, paddingTop: 14 },
    infoLabel: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
    state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  });
