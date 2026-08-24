import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
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

type ServiceItem = {
  id: string;
  title: string;
  description: string;
  image: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/* ============================================================
   SERVICES DATA
   ------------------------------------------------------------
   Temporary data.
   Later this will come from ADMIN / DATABASE.

   Maximum 25 services.
============================================================ */

const SERVICES_DATA: ServiceItem[] = [
  {
    id: '1',
    title: 'Healthcare Services',
    description:
      'Find useful healthcare information and services for the Malaysia–Myanmar community.',
    image:
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=90',
    icon: 'medical-outline',
  },
  {
    id: '2',
    title: 'Jobs & Employment',
    description:
      'Discover job opportunities and useful employment resources.',
    image:
      'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=90',
    icon: 'briefcase-outline',
  },
  {
    id: '3',
    title: 'Accommodation',
    description:
      'Find useful housing and accommodation information.',
    image:
      'https://images.unsplash.com/photo-1560185008-b033106af5c3?auto=format&fit=crop&w=1200&q=90',
    icon: 'home-outline',
  },
  {
    id: '4',
    title: 'Transportation',
    description:
      'Useful information about transport and travel.',
    image:
      'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1200&q=90',
    icon: 'car-outline',
  },
  {
    id: '5',
    title: 'Education Services',
    description:
      'Explore education resources and learning opportunities.',
    image:
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=90',
    icon: 'school-outline',
  },
  {
    id: '6',
    title: 'Legal Information',
    description:
      'Access useful legal information and resources.',
    image:
      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=90',
    icon: 'document-text-outline',
  },
  {
    id: '7',
    title: 'Financial Services',
    description:
      'Useful information about financial services.',
    image:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=90',
    icon: 'wallet-outline',
  },
  {
    id: '8',
    title: 'Translation Services',
    description:
      'Find translation and language support resources.',
    image:
      'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=90',
    icon: 'language-outline',
  },
  {
    id: '9',
    title: 'Document Services',
    description:
      'Useful document and application information.',
    image:
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=90',
    icon: 'documents-outline',
  },
  {
    id: '10',
    title: 'Community Support',
    description:
      'Connect with useful community support resources.',
    image:
      'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=90',
    icon: 'people-outline',
  },
  {
    id: '11',
    title: 'Business Services',
    description:
      'Useful resources for business and entrepreneurs.',
    image:
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=90',
    icon: 'business-outline',
  },
  {
    id: '12',
    title: 'Emergency Information',
    description:
      'Important emergency information and resources.',
    image:
      'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=90',
    icon: 'alert-circle-outline',
  },
  {
    id: '13',
    title: 'Insurance Services',
    description:
      'Find useful insurance information and resources.',
    image:
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=90',
    icon: 'shield-checkmark-outline',
  },
  {
    id: '14',
    title: 'Shopping Services',
    description:
      'Useful shopping information and local resources.',
    image:
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=90',
    icon: 'cart-outline',
  },
  {
    id: '15',
    title: 'Food & Restaurants',
    description:
      'Discover useful food and restaurant resources.',
    image:
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=90',
    icon: 'restaurant-outline',
  },
  {
    id: '16',
    title: 'Travel Information',
    description:
      'Useful travel information and resources.',
    image:
      'https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=1200&q=90',
    icon: 'airplane-outline',
  },
  {
    id: '17',
    title: 'Technology Services',
    description:
      'Find useful technology-related services.',
    image:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=90',
    icon: 'phone-portrait-outline',
  },
  {
    id: '18',
    title: 'Banking Information',
    description:
      'Useful banking and payment information.',
    image:
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=90',
    icon: 'card-outline',
  },
  {
    id: '19',
    title: 'Government Services',
    description:
      'Find useful government service information.',
    image:
      'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=90',
    icon: 'business-outline',
  },
  {
    id: '20',
    title: 'Family Services',
    description:
      'Useful services and information for families.',
    image:
      'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=90',
    icon: 'heart-outline',
  },
  {
    id: '21',
    title: 'Women Support',
    description:
      'Helpful resources and support services for women.',
    image:
      'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1200&q=90',
    icon: 'woman-outline',
  },
  {
    id: '22',
    title: 'Youth Services',
    description:
      'Useful opportunities and resources for young people.',
    image:
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=90',
    icon: 'people-circle-outline',
  },
  {
    id: '23',
    title: 'Community Help',
    description:
      'Find helpful community support resources.',
    image:
      'https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?auto=format&fit=crop&w=1200&q=90',
    icon: 'help-circle-outline',
  },
  {
    id: '24',
    title: 'Community Events',
    description:
      'Discover upcoming community events and activities.',
    image:
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=90',
    icon: 'calendar-outline',
  },
  {
    id: '25',
    title: 'Other Services',
    description:
      'Explore additional useful services and resources.',
    image:
      'https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1200&q=90',
    icon: 'grid-outline',
  },
];

/* ============================================================
   SERVICES SCREEN
============================================================ */

export default function ServicesScreen() {
  const { width, height } = useWindowDimensions();
  const { theme } = useAppTheme();

  const styles = createStyles(theme.colors);

  /* ==========================================================
     SELECTED SERVICE
  ========================================================== */

  const [selectedService, setSelectedService] =
    useState<ServiceItem | null>(null);

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
     SERVICE CARD
  ========================================================== */

  const renderServiceCard = ({
    item,
  }: {
    item: ServiceItem;
  }) => {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.serviceCard,
          pressed && styles.cardPressed,
        ]}
        onPress={() => setSelectedService(item)}
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
            style={styles.serviceImage}
            resizeMode="cover"
          />

          <View style={styles.imageOverlay} />

          {/* SERVICE ICON */}

          <View style={styles.serviceIcon}>
            <Ionicons
              name={item.icon}
              size={19}
              color="#FFFFFF"
            />
          </View>
        </View>

        {/* ====================================================
            CONTENT
        ==================================================== */}

        <View style={styles.serviceContent}>
          <View style={styles.titleRow}>
            <Text
              style={styles.serviceTitle}
              numberOfLines={4}
              ellipsizeMode="tail"
              allowFontScaling={false}
            >
              {item.title}
            </Text>

            <Ionicons
              name="chevron-forward"
              size={19}
              color={theme.colors.textMuted}
            />
          </View>

          <Text
            style={styles.serviceDescription}
            numberOfLines={4}
            ellipsizeMode="tail"
            allowFontScaling={false}
          >
            {item.description}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.availableLabel}>
              <View style={styles.availableDot} />

              <Text
                style={styles.availableText}
                allowFontScaling={false}
              >
                Available service
              </Text>
            </View>
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
            Services
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
            SECTION HEADER
        ==================================================== */}

        <View style={styles.sectionHeader}>
          <Text
            style={styles.sectionTitle}
            allowFontScaling={false}
          >
            All Services
          </Text>

          <Text
            style={styles.latestText}
            allowFontScaling={false}
          >
            Latest
          </Text>
        </View>

        {/* ====================================================
            SERVICES LIST
        ==================================================== */}

        <FlatList
          data={SERVICES_DATA.slice(0, 25)}
          keyExtractor={(item) => item.id}
          renderItem={renderServiceCard}
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

        {/* ====================================================
            SERVICE INFORMATION MODAL
        ==================================================== */}

        <Modal
          visible={selectedService !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedService(null)}
        >
          <View style={styles.modalContainer}>

            {/* BACKDROP */}

            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setSelectedService(null)}
            />

            {/* MODAL */}

            <View style={styles.modalCard}>

              {/* MODAL HEADER */}

              <View style={styles.modalHeader}>
                <Text
                  style={styles.modalTitle}
                  numberOfLines={4}
                  allowFontScaling={false}
                >
                  {selectedService?.title}
                </Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.modalClose,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setSelectedService(null)}
                  hitSlop={6}
                >
                  <Ionicons
                    name="close"
                    size={21}
                    color={theme.colors.text}
                  />
                </Pressable>
              </View>

              {/* MODAL IMAGE */}

              {selectedService && (
                <Image
                  source={{ uri: selectedService.image }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />
              )}

              {/* MODAL DESCRIPTION */}

              <Text
                style={styles.modalDescription}
                allowFontScaling={false}
              >
                {selectedService?.description}
              </Text>

              {/* INFORMATION */}

              <View style={styles.modalInfoBox}>
                <View style={styles.modalInfoIcon}>
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>

                <View style={styles.modalInfoContent}>
                  <Text
                    style={styles.modalInfoTitle}
                    allowFontScaling={false}
                  >
                    Service information
                  </Text>

                  <Text
                    style={styles.modalInfoText}
                    allowFontScaling={false}
                  >
                    More information, contact details,
                    locations, opening hours, links, and
                    other service details can be managed
                    by the administrator later.
                  </Text>
                </View>
              </View>

              {/* CLOSE BUTTON */}

              <Pressable
                style={({ pressed }) => [
                  styles.modalDoneButton,
                  pressed && styles.actionPressed,
                ]}
                onPress={() => setSelectedService(null)}
              >
                <Text
                  style={styles.modalDoneText}
                  allowFontScaling={false}
                >
                  Close
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