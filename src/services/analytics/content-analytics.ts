import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiRequest } from '@/services/api/client';

type ContentType = 'news' | 'service';
type EventType = 'view' | 'click';

const VIEWER_KEY = 'sagawa.analytics.viewer-id';

async function getViewerId() {
  let value = await AsyncStorage.getItem(VIEWER_KEY);
  if (value) return value;

  value = `viewer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;

  await AsyncStorage.setItem(VIEWER_KEY, value);
  return value;
}

export async function trackContentEvent(
  contentType: ContentType,
  contentId: string | number,
  eventType: EventType,
) {
  try {
    const viewerId = await getViewerId();

    await apiRequest('/api/analytics/event', {
      method: 'POST',
      body: JSON.stringify({
        contentType,
        contentId: String(contentId),
        eventType,
        viewerId,
      }),
    });
  } catch (error) {
    // Analytics must never interrupt the user's content experience.
    console.log('[Analytics] Event skipped:', error);
  }
}
