import { Tabs, router, usePathname } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  View,
} from 'react-native';

import { useTranslation } from '@/locales';
import { useAppTheme } from '@/theme/provider';

const TAB_ROUTES = [
  'index',
  'news',
  'exchange',
  'services',
  'profile',
] as const;

export default function TabsLayout() {
  const { theme } = useAppTheme();
  const { t } = useTranslation();
  const pathname = usePathname();

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