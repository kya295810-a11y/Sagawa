import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import SagawaFlowerLogo from '../../../assets/images/sagawa-flower-logo.svg';
import { useAppTheme } from '@/theme/provider';

type BrandedLoaderProps = {
  message?: string;
  compact?: boolean;
  style?: ViewStyle;
};

export function BrandedLoader({
  message = 'Loading Sagawa…',
  compact = false,
  style,
}: BrandedLoaderProps) {
  const { theme } = useAppTheme();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      style={[
        styles.container,
        compact && styles.compact,
        { backgroundColor: compact ? 'transparent' : theme.colors.background },
        style,
      ]}
    >
      <View
        style={[
          styles.logoShell,
          compact && styles.logoShellCompact,
          {
            backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
            borderColor: theme.colors.border,
          },
        ]}
      >
        <SagawaFlowerLogo
          width={compact ? 38 : 54}
          height={compact ? 38 : 54}
          accessibilityLabel="Sagawa logo"
        />
      </View>

      <ActivityIndicator size={compact ? 'small' : 'large'} color={theme.colors.primary} />

      <Text
        allowFontScaling={false}
        style={[styles.message, compact && styles.messageCompact, { color: theme.colors.textMuted }]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  compact: {
    flex: 0,
    minHeight: 150,
    paddingVertical: 24,
  },
  logoShell: {
    width: 82,
    height: 82,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  logoShellCompact: {
    width: 60,
    height: 60,
    borderRadius: 20,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  messageCompact: {
    fontSize: 13,
  },
});
