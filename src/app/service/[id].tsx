import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useAppTheme } from '@/theme/provider';
import type { ThemeColors } from '@/theme/types';

const ANDROID_EXTRA_BOLD = Platform.OS === 'android' ? '700' : '800';

/* ============================================================
   SERVICE TYPE
============================================================ */

type ServiceItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  image: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/* ============================================================
   TEMPORARY SERVICE DATA

   Later this will come from ADMIN / DATABASE.
============================================================ */

const SERVICES_DATA: ServiceItem[] = [
  {
    id: '1',
    category: 'Healthcare',
    title: 'Healthcare Services',
    description:
      'Find useful healthcare information and services for the Malaysia–Myanmar community.',
    image:
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=90',
    icon: 'medical-outline',
  },
  {
    id: '2',
    category: 'Jobs',
    title: 'Jobs & Employment',
    description:
      'Discover job opportunities and useful employment resources.',
    image:
      'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=90',
    icon: 'briefcase-outline',
  },
  {
    id: '3',
    category: 'Accommodation',
    title: 'Accommodation',
    description:
      'Find useful housing and accommodation information.',
    image:
      'https://images.unsplash.com/photo-1560185008-b033106af5c3?auto=format&fit=crop&w=1200&q=90',
    icon: 'home-outline',
  },
  {
    id: '4',
    category: 'Transportation',
    title: 'Transportation',
    description:
      'Useful information about transport and travel.',
    image:
      'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1200&q=90',
    icon: 'car-outline',
  },
  {
    id: '5',
    category: 'Education',
    title: 'Education',
    description:
      'Explore education resources and learning opportunities.',
    image:
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=90',
    icon: 'school-outline',
  },
  {
    id: '6',
    category: 'Legal',
    title: 'Legal Information',
    description:
      'Access useful legal information and resources.',
    image:
      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=90',
    icon: 'document-text-outline',
  },
  {
    id: '7',
    category: 'Finance',
    title: 'Financial Services',
    description:
      'Useful information about financial services.',
    image:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=90',
    icon: 'wallet-outline',
  },
  {
    id: '8',
    category: 'Translation',
    title: 'Translation Services',
    description:
      'Find translation and language support resources.',
    image:
      'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=90',
    icon: 'language-outline',
  },
  {
    id: '9',
    category: 'Documents',
    title: 'Document Services',
    description:
      'Useful document and application information.',
    image:
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=90',
    icon: 'documents-outline',
  },
  {
    id: '10',
    category: 'Community',
    title: 'Community Support',
    description:
      'Connect with useful community support resources.',
    image:
      'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=90',
    icon: 'people-outline',
  },
];

/* ============================================================
   SERVICE DETAIL SCREEN
============================================================ */

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { theme } = useAppTheme();

  const styles = createStyles(theme.colors);

  /* ==========================================================
     FIND SERVICE
  ========================================================== */

  const service = SERVICES_DATA.find(
    (item) => item.id === id
  );

  /* ==========================================================
     NOT FOUND
  ========================================================== */

  if (!service) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={['top']}
      >
        <StatusBar style={theme.statusBarStyle} />

        <View style={styles.notFound}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={theme.colors.primary}
          />

          <Text style={styles.notFoundTitle}>
            Service not found
          </Text>

          <Text style={styles.notFoundText}>
            This service is no longer available.
          </Text>

          <Pressable
            style={styles.backButtonLarge}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* ==========================================================
     SCREEN
  ========================================================== */

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <StatusBar style={theme.statusBarStyle} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ====================================================
            TOP BAR
        ==================================================== */}

        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.back()}
            hitSlop={6}
          >
            <Ionicons
              name="arrow-back"
              size={21}
              color={theme.colors.text}
            />
          </Pressable>

          <Text
            style={styles.topBarTitle}
            numberOfLines={1}
          >
            Service
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.shareButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {}}
            hitSlop={6}
          >
            <Ionicons
              name="share-outline"
              size={20}
              color={theme.colors.text}
            />
          </Pressable>
        </View>

        {/* ====================================================
            IMAGE
        ==================================================== */}

        <View style={styles.imageCard}>
          <Image
            source={{ uri: service.image }}
            style={styles.image}
            resizeMode="cover"
          />

          <View style={styles.imageOverlay} />

          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {service.category}
            </Text>
          </View>

          <View style={styles.iconCircle}>
            <Ionicons
              name={service.icon}
              size={23}
              color="#FFFFFF"
            />
          </View>
        </View>

        {/* ====================================================
            TITLE
        ==================================================== */}

        <View style={styles.titleSection}>
          <Text
            style={styles.title}
            allowFontScaling={false}
          >
            {service.title}
          </Text>

          <View style={styles.availableRow}>
            <View style={styles.availableDot} />

            <Text style={styles.availableText}>
              Available service
            </Text>
          </View>
        </View>

        {/* ====================================================
            ABOUT
        ==================================================== */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            About this service
          </Text>

          <Text style={styles.description}>
            {service.description}
          </Text>

          <Text style={styles.description}>
            This service provides useful information and
            resources for the Malaysia–Myanmar community.
            More details and service information will be
            added here when available.
          </Text>
        </View>

        {/* ====================================================
            SERVICE INFORMATION
        ==================================================== */}

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>
                Service information
              </Text>

              <Text style={styles.infoText}>
                Check the available information before
                contacting or using this service.
              </Text>
            </View>
          </View>
        </View>

        {/* ====================================================
            ACTION
        ==================================================== */}

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionPressed,
          ]}
          onPress={() => {}}
        >
          <Ionicons
            name="arrow-forward-circle-outline"
            size={21}
            color="#FFFFFF"
          />

          <Text style={styles.actionText}>
            View Service
          </Text>
        </Pressable>

        <View style={styles.bottomSpace} />
      </ScrollView>
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

    content: {
      paddingHorizontal: 18,
      paddingBottom: 50,
    },

    /* ========================================================
       TOP BAR
    ======================================================== */

    topBar: {
      height: 58,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',

      marginBottom: 8,
    },

    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,

      backgroundColor: colors.surface,

      alignItems: 'center',
      justifyContent: 'center',

      borderWidth: 1,
      borderColor: colors.border,
    },

    topBarTitle: {
      flex: 1,

      color: colors.text,

      fontSize: 17,
      lineHeight: 22,
      fontWeight: '700',

      textAlign: 'center',

      marginHorizontal: 12,
    },

    shareButton: {
      width: 44,
      height: 44,
      borderRadius: 22,

      backgroundColor: colors.surface,

      alignItems: 'center',
      justifyContent: 'center',

      borderWidth: 1,
      borderColor: colors.border,
    },

    buttonPressed: {
      opacity: 0.7,

      transform: [
        {
          scale: 0.94,
        },
      ],
    },

    /* ========================================================
       IMAGE
    ======================================================== */

    imageCard: {
      width: '100%',
      height: 230,

      borderRadius: 22,

      overflow: 'hidden',

      backgroundColor: colors.surface,

      borderWidth: 1,
      borderColor: colors.border,
    },

    image: {
      width: '100%',
      height: '100%',
    },

    imageOverlay: {
      position: 'absolute',

      left: 0,
      right: 0,
      bottom: 0,

      height: 100,

      backgroundColor: 'rgba(0,0,0,0.20)',
    },

    categoryBadge: {
      position: 'absolute',

      left: 14,
      bottom: 14,

      paddingHorizontal: 10,
      paddingVertical: 6,

      borderRadius: 10,

      backgroundColor: 'rgba(255,255,255,0.94)',
    },

    categoryText: {
      color: '#087CFF',

      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
    },

    iconCircle: {
      position: 'absolute',

      top: 14,
      right: 14,

      width: 42,
      height: 42,

      borderRadius: 21,

      backgroundColor: 'rgba(10,23,42,0.58)',

      alignItems: 'center',
      justifyContent: 'center',

      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
    },

    /* ========================================================
       TITLE
    ======================================================== */

    titleSection: {
      paddingTop: 18,
      paddingBottom: 8,
    },

    title: {
      color: colors.text,

      fontSize: 29,
      lineHeight: 35,

      fontWeight: ANDROID_EXTRA_BOLD,

      letterSpacing: -0.7,

      includeFontPadding: false,
    },

    availableRow: {
      flexDirection: 'row',
      alignItems: 'center',

      marginTop: 9,
    },

    availableDot: {
      width: 7,
      height: 7,

      borderRadius: 4,

      backgroundColor: colors.primary,

      marginRight: 6,
    },

    availableText: {
      color: colors.primary,

      fontSize: 11,
      lineHeight: 15,
      fontWeight: '600',
    },

    /* ========================================================
       SECTION
    ======================================================== */

    section: {
      marginTop: 22,
    },

    sectionTitle: {
      color: colors.text,

      fontSize: 20,
      lineHeight: 26,

      fontWeight: '700',

      marginBottom: 9,
    },

    description: {
      color: colors.textMuted,

      fontSize: 14,
      lineHeight: 21,

      marginBottom: 12,
    },

    /* ========================================================
       INFO CARD
    ======================================================== */

    infoCard: {
      marginTop: 12,

      padding: 16,

      backgroundColor: colors.surface,

      borderWidth: 1,
      borderColor: colors.border,

      borderRadius: 20,
    },

    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    infoIcon: {
      width: 42,
      height: 42,

      borderRadius: 14,

      backgroundColor: colors.primarySoft,

      alignItems: 'center',
      justifyContent: 'center',

      marginRight: 12,
    },

    infoContent: {
      flex: 1,
    },

    infoTitle: {
      color: colors.text,

      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
    },

    infoText: {
      color: colors.textMuted,

      fontSize: 11,
      lineHeight: 16,

      marginTop: 3,
    },

    /* ========================================================
       ACTION BUTTON
    ======================================================== */

    actionButton: {
      height: 52,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',

      backgroundColor: colors.primary,

      borderRadius: 17,

      marginTop: 22,

      gap: 8,
    },

    actionPressed: {
      opacity: 0.8,

      transform: [
        {
          scale: 0.985,
        },
      ],
    },

    actionText: {
      color: '#FFFFFF',

      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
    },

    /* ========================================================
       NOT FOUND
    ======================================================== */

    notFound: {
      flex: 1,

      alignItems: 'center',
      justifyContent: 'center',

      paddingHorizontal: 30,
    },

    notFoundTitle: {
      color: colors.text,

      fontSize: 21,
      lineHeight: 27,
      fontWeight: '700',

      marginTop: 14,
    },

    notFoundText: {
      color: colors.textMuted,

      fontSize: 13,
      lineHeight: 18,

      marginTop: 6,

      textAlign: 'center',
    },

    backButtonLarge: {
      marginTop: 22,

      paddingHorizontal: 22,
      paddingVertical: 12,

      borderRadius: 14,

      backgroundColor: colors.primary,
    },

    backButtonText: {
      color: '#FFFFFF',

      fontSize: 13,
      lineHeight: 17,
      fontWeight: '700',
    },

    /* ========================================================
       BOTTOM
    ======================================================== */

    bottomSpace: {
      height: 30,
    },
  });
