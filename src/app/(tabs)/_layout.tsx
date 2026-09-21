import { Tabs, router, usePathname } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  AppState,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from '@/locales';
import { useAppTheme } from '@/theme/provider';
import { apiRequest } from '@/services/api/client';
import { fetchNews } from '@/services/news/news-service';

const TAB_ROUTES = [
  'index',
  'news',
  'exchange',
  'services',
  'profile',
] as const;

const SEEN_NEWS_KEY = 'sagawa.content.seen.news.v1';
const SEEN_SERVICES_KEY = 'sagawa.content.seen.services.v1';
const MAX_SEEN_IDS = 500;
const BADGE_REFRESH_MS = 45_000;

async function readSeenIds(key: string) {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored === null) return null;
    const parsed: unknown = JSON.parse(stored);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string')
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

async function writeSeenIds(key: string, ids: string[]) {
  const unique = Array.from(new Set(ids)).slice(-MAX_SEEN_IDS);
  await AsyncStorage.setItem(key, JSON.stringify(unique));
}

function extractPublishedServiceIds(payload: unknown) {
  let value: unknown = payload;

  if (value && typeof value === 'object') {
    const root = value as Record<string, unknown>;
    value = root.data ?? root.services ?? root.items ?? root.results ?? value;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      value = nested.services ?? nested.items ?? nested.results ?? value;
    }
  }

  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const status = record.published ?? record.isPublished ?? record.status;
    const published =
      typeof status === 'boolean'
        ? status
        : typeof status === 'string'
          ? status.toLowerCase() === 'published'
          : true;

    if (!published) return [];
    return [String(record.id ?? record._id ?? `service-${index + 1}`)];
  });
}

export default function TabsLayout() {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const pathname = usePathname();
  const [newsBadge, setNewsBadge] = useState(0);
  const [servicesBadge, setServicesBadge] = useState(0);
  const latestNewsIds = useRef<string[]>([]);
  const latestServiceIds = useRef<string[]>([]);

  const refreshContentBadges = useCallback(async () => {
    try {
      const [newsResponse, servicesPayload, seenNews, seenServices] = await Promise.all([
        fetchNews(),
        apiRequest<unknown>('/api/services'),
        readSeenIds(SEEN_NEWS_KEY),
        readSeenIds(SEEN_SERVICES_KEY),
      ]);

      const newsIds = newsResponse.items
        .filter((item) => item.published)
        .map((item) => String(item.id));
      const serviceIds = extractPublishedServiceIds(servicesPayload);

      latestNewsIds.current = newsIds;
      latestServiceIds.current = serviceIds;

      const viewingNews = pathname.endsWith('/news');
      const viewingServices = pathname.endsWith('/services');

      // First run establishes a baseline so old content does not suddenly appear
      // as dozens of "new" notifications after this feature is installed.
      const effectiveSeenNews = seenNews ?? new Set(newsIds);
      const effectiveSeenServices = seenServices ?? new Set(serviceIds);

      if (seenNews === null) {
        await writeSeenIds(SEEN_NEWS_KEY, newsIds);
      }
      if (seenServices === null) {
        await writeSeenIds(SEEN_SERVICES_KEY, serviceIds);
      }

      if (viewingNews) {
        await writeSeenIds(SEEN_NEWS_KEY, [...effectiveSeenNews, ...newsIds]);
        setNewsBadge(0);
      } else {
        setNewsBadge(newsIds.filter((id) => !effectiveSeenNews.has(id)).length);
      }

      if (viewingServices) {
        await writeSeenIds(SEEN_SERVICES_KEY, [...effectiveSeenServices, ...serviceIds]);
        setServicesBadge(0);
      } else {
        setServicesBadge(serviceIds.filter((id) => !effectiveSeenServices.has(id)).length);
      }
    } catch (error) {
      console.warn('Content badge refresh failed:', error);
    }
  }, [pathname]);

  useEffect(() => {
    void refreshContentBadges();

    const interval = setInterval(() => {
      void refreshContentBadges();
    }, BADGE_REFRESH_MS);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshContentBadges();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [refreshContentBadges]);

  const currentTabIndex = TAB_ROUTES.findIndex(
    (tab) => {
      if (tab === 'index') {
        return (
          pathname === '/' ||
          pathname === '/(tabs)' ||
          pathname === '/(tabs)/'
        );
      }

      return pathname.endsWith(`/${tab}`);
    },
  );

  const activeIndex =
    currentTabIndex === -1
      ? 0
      : currentTabIndex;

  const goToTab = (
    direction: 'left' | 'right',
  ) => {
    let nextIndex = activeIndex;

    if (direction === 'left') {
      nextIndex = Math.min(
        activeIndex + 1,
        TAB_ROUTES.length - 1,
      );
    } else {
      nextIndex = Math.max(
        activeIndex - 1,
        0,
      );
    }

    if (nextIndex === activeIndex) {
      return;
    }

    const nextTab =
      TAB_ROUTES[nextIndex];

    if (nextTab === 'index') {
      router.replace('/(tabs)');
    } else {
      router.replace(
        `/(tabs)/${nextTab}` as any,
      );
    }
  };

  const panResponder =
    PanResponder.create({
      onMoveShouldSetPanResponder: (
        _event: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const { dx, dy } =
          gestureState;

        return (
          Math.abs(dx) > 30 &&
          Math.abs(dx) >
            Math.abs(dy) * 1.3
        );
      },

      onPanResponderRelease: (
        _event: GestureResponderEvent,
        gestureState: PanResponderGestureState,
      ) => {
        const { dx, vx } =
          gestureState;

        if (
          dx < -60 ||
          vx < -0.5
        ) {
          goToTab('left');
          return;
        }

        if (
          dx > 60 ||
          vx > 0.5
        ) {
          goToTab('right');
        }
      },
    });

  return (
    <View
      style={{
        flex: 1,
        backgroundColor:
          theme.colors.background,
      }}
      {...panResponder.panHandlers}
    >
      <Tabs
        screenOptions={{
          headerShown: false,

          sceneStyle: {
            backgroundColor:
              theme.colors.background,
          },

          /* ==================================================
             TAB COLORS
          ================================================== */

          tabBarActiveTintColor:
            theme.colors.text,

          tabBarInactiveTintColor:
            theme.colors.textMuted,

          /* ==================================================
             TAB LABEL
          ================================================== */

          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            letterSpacing: -0.1,
          },

          tabBarItemStyle: {
            paddingTop: 4,
          },

          /* ==================================================
             TAB BAR
          ================================================== */

          tabBarStyle: {
            backgroundColor:
              theme.colors.surface,

            borderTopWidth: 1,

            borderTopColor:
              theme.colors.border,

            height: 78,

            paddingTop: 7,
            paddingBottom: 8,
          },
        }}
      >
        {/* ==================================================
            HOME
        ================================================== */}

        <Tabs.Screen
          name="index"
          options={{
            title: t(
              'navigation.home',
            ),

            tabBarIcon: ({
              focused,
              color,
            }) => (
              <Ionicons
                name={
                  focused
                    ? 'home'
                    : 'home-outline'
                }
                color={color}
                size={23}
              />
            ),
          }}
        />

        {/* ==================================================
            NEWS
        ================================================== */}

        <Tabs.Screen
          name="news"
          options={{
            title: t(
              'navigation.news',
            ),

            tabBarIcon: ({
              focused,
              color,
            }) => (
              <Ionicons
                name={
                  focused
                    ? 'newspaper'
                    : 'newspaper-outline'
                }
                color={color}
                size={23}
              />
            ),
            tabBarBadge:
              newsBadge > 0
                ? newsBadge > 99
                  ? '99+'
                  : newsBadge
                : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#E5484D',
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: '700',
              minWidth: 18,
              height: 18,
            },
          }}
        />

        {/* ==================================================
            EXCHANGE
        ================================================== */}

        <Tabs.Screen
          name="exchange"
          options={{
            title: t(
              'navigation.exchange',
            ),

            tabBarIcon: ({
              color,
            }) => (
              <Ionicons
                name="swap-horizontal"
                color={color}
                size={23}
              />
            ),
          }}
        />

        {/* ==================================================
            SERVICES
        ================================================== */}

        <Tabs.Screen
          name="services"
          options={{
            title: t(
              'navigation.services',
            ),

            tabBarIcon: ({
              focused,
              color,
            }) => (
              <Ionicons
                name={
                  focused
                    ? 'grid'
                    : 'grid-outline'
                }
                color={color}
                size={23}
              />
            ),
            tabBarBadge:
              servicesBadge > 0
                ? servicesBadge > 99
                  ? '99+'
                  : servicesBadge
                : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#E5484D',
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: '700',
              minWidth: 18,
              height: 18,
            },
          }}
        />

        {/* ==================================================
            PROFILE
        ================================================== */}

        <Tabs.Screen
          name="profile"
          options={{
            title: t(
              'navigation.profile',
            ),

            tabBarIcon: ({
              focused,
              color,
            }) => (
              <Ionicons
                name={
                  focused
                    ? 'person'
                    : 'person-outline'
                }
                color={color}
                size={23}
              />
            ),
          }}
        />

        {/* ==================================================
            GOLD
            Hidden from tab bar
        ================================================== */}

        <Tabs.Screen
          name="gold"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </View>
  );
}