import type { ApiNewsItem, NewsArticle, PaginatedNewsResponse } from '@/features/news/types';
import { apiRequest } from '@/services/api/client';
import { resolveMediaUrl } from '@/utils/media';

function textValue(...values: unknown[]) {
  return values.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )?.trim();
}

function booleanValue(value: unknown) {
  return value === undefined ? true : value === true || value === 'true' || value === 1;
}

export function normalizeNewsItem(item: ApiNewsItem): NewsArticle {
  const videoPath = textValue(item.videoUrl, item.video_url, item.video);
  const imagePath = textValue(item.imageUrl, item.image_url, item.image);
  const thumbnailPath = textValue(item.thumbnailUrl, item.thumbnail_url) ?? (videoPath ? imagePath : undefined);
  const mediaType =
    item.mediaType === 'video' || item.media_type === 'video' || videoPath ? 'video' : 'image';

  return {
    id: String(item.id ?? ''),
    category: textValue(item.category) ?? 'Latest',
    title: textValue(item.title, item.name) ?? '',
    description: textValue(item.description, item.content, item.body) ?? '',
    date: textValue(item.date, item.publishedAt, item.createdAt) ?? '',
    published: booleanValue(item.published),
    mediaType,
    imageUrl: mediaType === 'image' ? resolveMediaUrl(imagePath) : undefined,
    videoUrl: mediaType === 'video' ? resolveMediaUrl(videoPath) : undefined,
    thumbnailUrl: mediaType === 'video' ? resolveMediaUrl(thumbnailPath) : undefined,
  };
}

export async function fetchNews(cursor?: string | null, limit = 4) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 4, 1), 20);
  const params = [`limit=${safeLimit}`];

  if (cursor) {
    params.push(`cursor=${encodeURIComponent(cursor)}`);
  }

  const response = await apiRequest<{
    success?: boolean;
    data?: ApiNewsItem[];
    nextCursor?: string | null;
  }>(`/api/news?${params.join('&')}`);

  if (!response.success || !Array.isArray(response.data)) {
    throw new Error('Invalid news API response.');
  }

  return {
    items: response.data.map(normalizeNewsItem),
    nextCursor: typeof response.nextCursor === 'string' ? response.nextCursor : null,
  } satisfies PaginatedNewsResponse;
}

export async function fetchNewsById(id: string, signal?: AbortSignal) {
  const response = await apiRequest<{ success?: boolean; data?: ApiNewsItem }>(
    `/api/news/${encodeURIComponent(id)}`,
    { signal },
  );
  if (!response.success || !response.data) throw new Error('News not found.');
  return normalizeNewsItem(response.data);
}
