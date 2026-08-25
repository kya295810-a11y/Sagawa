import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useAppTheme } from '@/theme/provider';
import type { ThemeColors } from '@/theme/types';
import { env } from '@/config/env';

const API_BASE_URL = env.EXPO_PUBLIC_API_URL;

const SERVICES_ENDPOINT = `${API_BASE_URL}/api/services`;

type ServiceItem = {
  id: string;
  title: string;
  description: string;
  image: string;
  icon: keyof typeof Ionicons.glyphMap;
  details?: string;
  contact?: string;
  location?: string;
  openingHours?: string;
  website?: string;
};

const DEFAULT_ICON: keyof typeof Ionicons.glyphMap = 'grid-outline';

function textValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function imageValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return textValue(v.url, v.uri, v.path, v.src, v.location);
  }
  return '';
}

function iconValue(value: unknown): keyof typeof Ionicons.glyphMap {
  return typeof value === 'string' && value in Ionicons.glyphMap
    ? (value as keyof typeof Ionicons.glyphMap)
    : DEFAULT_ICON;
}

function normalizeService(value: unknown, index: number): ServiceItem | null {
  if (!value || typeof value !== 'object') return null;

  const v = value as Record<string, unknown>;
  const title = textValue(v.title, v.name, v.serviceName, v.heading);
  if (!title) return null;

  const status = v.published ?? v.isPublished ?? v.status;
  const published =
    typeof status === 'boolean'
      ? status
      : typeof status === 'string'
        ? status.toLowerCase() === 'published'
        : true;

  if (!published) return null;

  return {
    id: String(v.id ?? v._id ?? `service-${index + 1}`),
    title,
    description: textValue(v.description, v.summary, v.excerpt),
    image: imageValue(v.image ?? v.imageUrl ?? v.image_url ?? v.photo ?? v.media),
    icon: iconValue(v.icon),
    details: textValue(v.details, v.detail, v.content),
    contact: textValue(v.contact, v.phone, v.email),
    location: textValue(v.location, v.address),
    openingHours: textValue(v.openingHours, v.opening_hours),
    website: textValue(v.website, v.url, v.link),
  };
}

function parseServices(payload: unknown): ServiceItem[] {
  let value: unknown = payload;

  if (payload && typeof payload === 'object') {
    const v = payload as Record<string, unknown>;
    value = v.data ?? v.services ?? v.items ?? v.results ?? payload;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      value = nested.services ?? nested.items ?? nested.results ?? value;
    }
  }

  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeService)
    .filter((item): item is ServiceItem => item !== null)
    .slice(0, 25);
}

export default function ServicesScreen() {
  const { width, height } = useWindowDimensions();
  const { theme } = useAppTheme();
  const styles = createStyles(theme.colors);

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [notificationVisible, setNotificationVisible] = useState(false);

  const imageHeight = height <= 700 ? 112 : height <= 780 ? 128 : 142;
  const contentWidth = width - 36;

  const loadServices = useCallback(async () => {
    try {
      setError('');

      const response = await fetch(SERVICES_ENDPOINT, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload: unknown = await response.json();
      setServices(parseServices(payload));
    } catch (requestError) {
      console.error('Services API error:', requestError);
      setError('Unable to load services. Make sure the admin API is running.');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadServices().finally(() => setLoading(false));
    }, 0);

    return () => clearTimeout(timer);
  }, [loadServices]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadServices();
    setRefreshing(false);
  }, [loadServices]);

  const filteredServices = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return services;

    return services.filter((service) =>
      `${service.title} ${service.description} ${service.location ?? ''}`
        .toLowerCase()
        .includes(query),
    );
  }, [searchText, services]);

  const renderServiceCard = ({ item }: { item: ServiceItem }) => (
    <Pressable
      style={({ pressed }) => [styles.serviceCard, pressed && styles.cardPressed]}
      onPress={() => setSelectedService(item)}
    >
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.serviceImage} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name={item.icon} size={38} color={theme.colors.primary} />
          </View>
        )}

        <View style={styles.imageOverlay} />

        <View style={styles.serviceIcon}>
          <Ionicons name={item.icon} size={19} color="#FFFFFF" />
        </View>
      </View>

      <View style={styles.serviceContent}>
        <View style={styles.titleRow}>
          <Text
            style={styles.serviceTitle}
            numberOfLines={3}
            ellipsizeMode="tail"
            allowFontScaling={false}
          >
            {item.title}
          </Text>

          <Ionicons name="chevron-forward" size={19} color={theme.colors.textMuted} />
        </View>

        {!!item.description && (
          <Text
            style={styles.serviceDescription}
            numberOfLines={4}
            ellipsizeMode="tail"
            allowFontScaling={false}
          >
            {item.description}
          </Text>
        )}

        <View style={styles.metaRow}>
          <View style={styles.availableLabel}>
            <View style={styles.availableDot} />
            <Text style={styles.availableText} allowFontScaling={false}>
              Available service
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style={theme.statusBarStyle} />

      <View style={styles.container}>
        <View style={styles.header}>
          {searchVisible ? (
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={19} color={theme.colors.textMuted} />

              <TextInput
                autoFocus
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Search services"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.searchInput}
                returnKeyType="search"
                keyboardType="default"
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
                onSubmitEditing={() => Keyboard.dismiss()}
              />

              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setSearchText('');
                  setSearchVisible(false);
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.title} allowFontScaling={false}>
                Services
              </Text>

              <View style={styles.headerActions}>
                <Pressable
                  style={({ pressed }) => [styles.headerButton, pressed && styles.buttonPressed]}
                  hitSlop={6}
                  onPress={() => setSearchVisible(true)}
                >
                  <Ionicons name="search-outline" size={21} color={theme.colors.text} />
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.headerButton, pressed && styles.buttonPressed]}
                  hitSlop={6}
                  onPress={() => setNotificationVisible(true)}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={21}
                    color={theme.colors.text}
                  />
                  {services.length > 0 && <View style={styles.notificationDot} />}
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle} allowFontScaling={false}>
            All Services
          </Text>
          <Text style={styles.latestText} allowFontScaling={false}>
            {filteredServices.length} available
          </Text>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <View style={styles.errorIcon}>
              <Ionicons
                name="cloud-offline-outline"
                size={20}
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.errorContent}>
              <Text style={styles.errorTitle} allowFontScaling={false}>
                Services unavailable
              </Text>
              <Text style={styles.errorText} allowFontScaling={false}>
                {error}
              </Text>
            </View>

            <Pressable
              style={styles.retryButton}
              onPress={() => {
                setLoading(true);
                void loadServices().finally(() => setLoading(false));
              }}
            >
              <Text style={styles.retryText} allowFontScaling={false}>
                Retry
              </Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.stateText} allowFontScaling={false}>
              Loading services...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredServices}
            keyExtractor={(item) => item.id}
            renderItem={renderServiceCard}
            showsVerticalScrollIndicator={false}
            directionalLockEnabled
            bounces
            nestedScrollEnabled
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={theme.colors.primary}
              />
            }
            contentContainerStyle={[
              styles.listContent,
              {
                width: contentWidth,
                flexGrow: filteredServices.length === 0 ? 1 : 0,
              },
            ]}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name={searchText.trim() ? 'search-outline' : 'grid-outline'}
                    size={28}
                    color={theme.colors.primary}
                  />
                </View>

                <Text style={styles.emptyTitle} allowFontScaling={false}>
                  {searchText.trim() ? 'No services found' : 'No published services'}
                </Text>

                <Text style={styles.emptyText} allowFontScaling={false}>
                  {searchText.trim()
                    ? 'Try a different search term.'
                    : 'Published services from the admin dashboard will appear here.'}
                </Text>

                {!searchText.trim() && (
                  <Pressable style={styles.emptyButton} onPress={refresh}>
                    <Text style={styles.emptyButtonText} allowFontScaling={false}>
                      Refresh
                    </Text>
                  </Pressable>
                )}
              </View>
            }
          />
        )}

        <Modal
          visible={selectedService !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedService(null)}
        >
          <View style={styles.modalContainer}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setSelectedService(null)}
            />

            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text
                  style={styles.modalTitle}
                  numberOfLines={4}
                  allowFontScaling={false}
                >
                  {selectedService?.title}
                </Text>

                <Pressable
                  style={({ pressed }) => [styles.modalClose, pressed && styles.buttonPressed]}
                  onPress={() => setSelectedService(null)}
                  hitSlop={6}
                >
                  <Ionicons name="close" size={21} color={theme.colors.text} />
                </Pressable>
              </View>

              {selectedService?.image ? (
                <Image
                  source={{ uri: selectedService.image }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.modalImagePlaceholder}>
                  <Ionicons
                    name={selectedService?.icon ?? DEFAULT_ICON}
                    size={42}
                    color={theme.colors.primary}
                  />
                </View>
              )}

              {!!selectedService?.description && (
                <Text style={styles.modalDescription} allowFontScaling={false}>
                  {selectedService.description}
                </Text>
              )}

              {!!selectedService?.details && (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailTitle} allowFontScaling={false}>
                    Details
                  </Text>
                  <Text style={styles.detailText} allowFontScaling={false}>
                    {selectedService.details}
                  </Text>
                </View>
              )}

              {[
                ['location-outline', selectedService?.location],
                ['call-outline', selectedService?.contact],
                ['time-outline', selectedService?.openingHours],
                ['globe-outline', selectedService?.website],
              ].map(([icon, value]) =>
                value ? (
                  <View style={styles.infoRow} key={`${icon}-${value}`}>
                    <Ionicons
                      name={icon as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.infoText} numberOfLines={3} allowFontScaling={false}>
                      {value}
                    </Text>
                  </View>
                ) : null,
              )}

              <Pressable
                style={({ pressed }) => [styles.modalDoneButton, pressed && styles.actionPressed]}
                onPress={() => setSelectedService(null)}
              >
                <Text style={styles.modalDoneText} allowFontScaling={false}>
                  Close
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={notificationVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setNotificationVisible(false)}
        >
          <View style={styles.notificationModal}>
            <Pressable
              style={styles.notificationBackdrop}
              onPress={() => setNotificationVisible(false)}
            />

            <View style={styles.notificationCard}>
              <View style={styles.notificationIconLarge}>
                <Ionicons
                  name="notifications-outline"
                  size={25}
                  color={theme.colors.primary}
                />
              </View>

              <Text style={styles.notificationTitle} allowFontScaling={false}>
                Services updates
              </Text>

              <Text style={styles.notificationText} allowFontScaling={false}>
                Published service updates from the administrator will appear here.
              </Text>

              <Pressable
                style={styles.notificationButton}
                onPress={() => setNotificationVisible(false)}
              >
                <Text style={styles.notificationButtonText} allowFontScaling={false}>
                  Done
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

/* ============================================================
   STYLES
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
        imagePlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },

    searchBar: {
      flex: 1,
      height: 46,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 13,
      borderRadius: 15,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 9,
    },

    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '500',
      paddingVertical: 0,
    },

    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      marginBottom: 10,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    errorIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },

    errorContent: {
      flex: 1,
    },

    errorTitle: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
    },

    errorText: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 2,
    },

    retryButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
    },

    retryText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
    },

    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 80,
    },

    stateText: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 10,
    },

    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
      paddingBottom: 90,
    },

    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },

    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '800',
      textAlign: 'center',
    },

    emptyText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: 6,
    },

    emptyButton: {
      marginTop: 16,
      paddingHorizontal: 18,
      height: 42,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },

    modalImagePlaceholder: {
      width: '100%',
      height: 180,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 15,
    },

    detailBlock: {
      padding: 13,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },

    detailTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 4,
    },

    detailText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },

    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 7,
    },

    infoText: {
      flex: 1,
      color: colors.text,
      fontSize: 12,
      lineHeight: 18,
      marginLeft: 9,
    },

    notificationModal: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },

    notificationBackdrop: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.48)',
    },

    notificationCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 22,
      alignItems: 'center',
    },

    notificationIconLarge: {
      width: 54,
      height: 54,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 13,
    },

    notificationTitle: {
      color: colors.text,
      fontSize: 19,
      lineHeight: 25,
      fontWeight: '800',
      textAlign: 'center',
    },

    notificationText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: 7,
    },

    notificationButton: {
      width: '100%',
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 18,
    },

    notificationButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
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
      paddingBottom: 30,
    },

    /* ========================================================
       SERVICE CARD
    ======================================================== */

    serviceCard: {
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

    serviceImage: {
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
       SERVICE ICON
    ======================================================== */

    serviceIcon: {
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

    serviceContent: {
      paddingHorizontal: 14,
      paddingTop: 11,
      paddingBottom: 11,
    },

    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    serviceTitle: {
      flex: 1,

      color: colors.text,

      fontSize: 16,
      lineHeight: 21,

      fontWeight: '700',

      letterSpacing: -0.15,

      includeFontPadding: false,

      paddingRight: 8,
    },

    serviceDescription: {
      color: colors.textMuted,

      fontSize: 12,
      lineHeight: 17,

      fontWeight: '500',

      marginTop: 5,

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

    availableLabel: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    availableDot: {
      width: 6,
      height: 6,

      borderRadius: 3,

      backgroundColor: colors.primary,

      marginRight: 5,
    },

    availableText: {
      color: colors.primary,

      fontSize: 10,
      lineHeight: 14,

      fontWeight: '600',

      includeFontPadding: false,
    },

    /* ========================================================
       MODAL
    ======================================================== */

    modalContainer: {
      flex: 1,

      justifyContent: 'flex-end',
    },

    modalBackdrop: {
      position: 'absolute',

      left: 0,
      right: 0,
      top: 0,
      bottom: 0,

      backgroundColor: 'rgba(0,0,0,0.48)',
    },

    modalCard: {
      backgroundColor: colors.surface,

      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,

      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 30,

      borderWidth: 1,
      borderColor: colors.border,

      maxHeight: '82%',
    },

    modalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',

      marginBottom: 14,
    },

    modalTitle: {
      flex: 1,

      color: colors.text,

      fontSize: 23,
      lineHeight: 29,

      fontWeight: '800',

      letterSpacing: -0.5,

      paddingRight: 12,
    },

    modalClose: {
      width: 40,
      height: 40,

      borderRadius: 20,

      backgroundColor: colors.background,

      alignItems: 'center',
      justifyContent: 'center',

      borderWidth: 1,
      borderColor: colors.border,
    },

    modalImage: {
      width: '100%',
      height: 180,

      borderRadius: 18,

      backgroundColor: colors.background,

      marginBottom: 15,
    },

    modalDescription: {
      color: colors.textMuted,

      fontSize: 14,
      lineHeight: 21,

      marginBottom: 14,
    },

    modalInfoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',

      backgroundColor: colors.background,

      borderWidth: 1,
      borderColor: colors.border,

      borderRadius: 17,

      padding: 13,
    },

    modalInfoIcon: {
      width: 38,
      height: 38,

      borderRadius: 12,

      backgroundColor: colors.primarySoft,

      alignItems: 'center',
      justifyContent: 'center',

      marginRight: 10,
    },

    modalInfoContent: {
      flex: 1,
    },

    modalInfoTitle: {
      color: colors.text,

      fontSize: 13,
      lineHeight: 18,

      fontWeight: '700',
    },

    modalInfoText: {
      color: colors.textMuted,

      fontSize: 11,
      lineHeight: 17,

      marginTop: 3,
    },

    modalDoneButton: {
      height: 48,

      alignItems: 'center',
      justifyContent: 'center',

      backgroundColor: colors.primary,

      borderRadius: 15,

      marginTop: 16,
    },

    modalDoneText: {
      color: '#FFFFFF',

      fontSize: 13,
      lineHeight: 17,

      fontWeight: '700',
    },

    actionPressed: {
      opacity: 0.8,

      transform: [
        {
          scale: 0.985,
        },
      ],
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