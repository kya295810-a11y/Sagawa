import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { env } from '@/config/env';
import {
  ImageBackground,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAppTheme } from '@/theme/provider';

const API_BASE_URL = env.EXPO_PUBLIC_API_URL;

type ExchangeResponse = {
  success?: boolean;
  data?: {
    rate?: number | string;
    updatedAt?: string;
    rates?: Array<{
      currency?: string;
      buy?: number | string;
    }>;
  };
};

const KL_EXCHANGE = require('../../../assets/images/kl-exchange-premium.png');

export default function ExchangeScreen() {
  const { theme } = useAppTheme();
  const { height } = useWindowDimensions();

  const [amount, setAmount] = useState('100');
  const [reverse, setReverse] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadExchangeRate = useCallback(async () => {
    try {
      setRefreshing(true);

      const response = await fetch(`${API_BASE_URL}/api/exchange`);

      if (!response.ok) {
        throw new Error(`Exchange API returned ${response.status}`);
      }

      const payload = (await response.json()) as ExchangeResponse;

      const directRate = Number(payload.data?.rate);
      const firstRate = Number(payload.data?.rates?.[0]?.buy);

      const nextRate =
        Number.isFinite(directRate) && directRate > 0
          ? directRate
          : Number.isFinite(firstRate) && firstRate > 0
            ? firstRate
            : NaN;

      if (!Number.isFinite(nextRate) || nextRate <= 0) {
        throw new Error('Invalid exchange rate received from API');
      }

      setExchangeRate(nextRate);
      setUpdatedAt(payload.data?.updatedAt ?? null);
    } catch (error) {
      console.error('Exchange API error:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadExchangeRate();
  }, [loadExchangeRate]);

  /*
   * ============================================================
   * HERO SIZE
   * ============================================================
   *
   * The hero is intentionally kept compact.
   * This prevents the KL image from being stretched vertically.
   */

  const heroHeight =
    height <= 700
      ? 320
      : height <= 800
        ? 340
        : 360;

  /*
   * ============================================================
   * CURRENCY
   * ============================================================
   */

  const fromCurrency = reverse ? 'MMK' : 'MYR';
  const toCurrency = reverse ? 'MYR' : 'MMK';

  const fromFlag = reverse ? '🇲🇲' : '🇲🇾';
  const toFlag = reverse ? '🇲🇾' : '🇲🇲';

  const fromName = reverse
    ? 'Myanmar Kyat'
    : 'Malaysian Ringgit';

  const toName = reverse
    ? 'Malaysian Ringgit'
    : 'Myanmar Kyat';

  /*
   * ============================================================
   * CALCULATION
   * ============================================================
   */

  const numericAmount =
    Number(amount.replace(/,/g, '')) || 0;

  const calculatedAmount = useMemo(() => {
    if (!exchangeRate || !Number.isFinite(exchangeRate)) {
      return null;
    }

    if (reverse) {
      return numericAmount / exchangeRate;
    }

    return numericAmount * exchangeRate;
  }, [numericAmount, reverse, exchangeRate]);

  const rateValue =
    exchangeRate && Number.isFinite(exchangeRate)
      ? reverse
        ? 1 / exchangeRate
        : exchangeRate
      : null;

  /*
   * ============================================================
   * FORMAT NUMBER
   * ============================================================
   */

  const formatNumber = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) {
      return '—';
    }

    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatRate = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) {
      return '—';
    }

    return value.toLocaleString('en-US', {
      minimumFractionDigits: reverse ? 5 : 2,
      maximumFractionDigits: reverse ? 5 : 2,
    });
  };

  const inputAccessoryViewID = 'exchange-amount-input-accessory';

  /*
   * ============================================================
   * INPUT
   * ============================================================
   */

  const handleAmountChange = (value: string) => {
    const cleaned = value
      .replace(/,/g, '')
      .replace(/[^0-9.]/g, '');

    const parts = cleaned.split('.');

    if (parts.length > 2) {
      return;
    }

    if (parts[1]?.length > 2) {
      return;
    }

    setAmount(cleaned);
  };

  /*
   * ============================================================
   * ACTIONS
   * ============================================================
   */

  const swapCurrencies = () => {
    setReverse((current) => !current);
  };

  const clearAmount = () => {
    setAmount('');
  };

  const resetAmount = () => {
    setAmount('100');
  };

  const styles = createStyles(theme.colors);

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <StatusBar
        style={theme.statusBarStyle}
      />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          onScrollBeginDrag={Keyboard.dismiss}
          contentContainerStyle={
            styles.scrollContent
          }
        >
          {/* ==================================================
              PREMIUM KL HERO
          ================================================== */}

          <ImageBackground
            source={KL_EXCHANGE}
            style={[
              styles.hero,
              {
                height: heroHeight,
              },
            ]}
            imageStyle={styles.heroImage}
            resizeMode="cover"
          >
            {/* IMAGE VISIBILITY OVERLAY */}

            <View
              style={[
                styles.heroOverlay,
                {
                  backgroundColor:
                    theme.isDark
                      ? 'rgba(5,12,22,0.42)'
                      : 'rgba(5,16,30,0.16)',
                },
              ]}
            >
              {/* ==================================================
                  HEADER
              ================================================== */}

              <View style={styles.header}>
                <View
                  style={styles.headerLeft}
                >
                  <View
                    style={styles.appIcon}
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={22}
                      color="#FFFFFF"
                    />
                  </View>

                  <View
                    style={styles.headerText}
                  >
                    <Text
                      style={styles.heroTitle}
                      allowFontScaling={false}
                    >
                      Exchange Rate
                    </Text>

                    <View
                      style={
                        styles.updatedRow
                      }
                    >
                      <View
                        style={styles.liveDot}
                      />

                      <Text
                        style={
                          styles.updatedText
                        }
                        allowFontScaling={
                          false
                        }
                      >
                        Updated {updatedAt
                          ? new Date(updatedAt).toLocaleTimeString(
                              'en-US',
                              {
                                hour: 'numeric',
                                minute: '2-digit',
                              },
                            )
                          : 'Latest rate'}
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  onPress={loadExchangeRate}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.refreshButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  {refreshing ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <Ionicons
                      name="refresh"
                      size={18}
                      color="#FFFFFF"
                    />
                  )}
                </Pressable>
              </View>

              {/* ==================================================
                  CURRENCY PAIR
              ================================================== */}

              <View
                style={
                  styles.currencyPair
                }
              >
                <View
                  style={[
                    styles.currencySide,
                    styles.leftSide,
                  ]}
                >
                  <Text
                    style={styles.flag}
                  >
                    {fromFlag}
                  </Text>

                  <Text
                    style={styles.currencyCode}
                    allowFontScaling={
                      false
                    }
                  >
                    {fromCurrency}
                  </Text>

                  <Text
                    style={styles.currencyName}
                    allowFontScaling={
                      false
                    }
                  >
                    {fromName}
                  </Text>
                </View>

                <Pressable
                  onPress={swapCurrencies}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.heroSwap,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="swap-horizontal"
                    size={24}
                    color={
                      theme.colors.primary
                    }
                  />
                </Pressable>

                <View
                  style={[
                    styles.currencySide,
                    styles.rightSide,
                  ]}
                >
                  <Text
                    style={styles.flag}
                  >
                    {toFlag}
                  </Text>

                  <Text
                    style={styles.currencyCode}
                    allowFontScaling={
                      false
                    }
                  >
                    {toCurrency}
                  </Text>

                  <Text
                    style={styles.currencyName}
                    allowFontScaling={
                      false
                    }
                  >
                    {toName}
                  </Text>
                </View>
              </View>

              {/* ==================================================
                  MAIN RATE
              ================================================== */}

              <View
                style={styles.rateArea}
              >
                <Text
                  style={styles.rateLabel}
                  allowFontScaling={false}
                >
                  1 {fromCurrency}
                </Text>

                <View
                  style={styles.rateRow}
                >
                  <Text
                    style={styles.rateNumber}
                    allowFontScaling={false}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                  >
                    {formatRate(rateValue)}
                  </Text>

                  <Text
                    style={styles.rateCurrency}
                    allowFontScaling={false}
                  >
                    {toCurrency}
                  </Text>
                </View>
              </View>

              {/* ==================================================
                  CHANGE BADGE
              ================================================== */}

              <View
                style={styles.changeBadge}
              >
                <Ionicons
                  name="trending-up"
                  size={13}
                  color="#078A50"
                />

                <Text
                  style={styles.changeText}
                  allowFontScaling={false}
                >
                  Admin-controlled rate
                </Text>
              </View>
            </View>
          </ImageBackground>

          {/* ==================================================
              FLOATING CONVERTER
          ================================================== */}

          <View
            style={[
              styles.converter,
              {
                backgroundColor:
                  theme.colors.surface,
                borderColor:
                  theme.colors.border,
              },
            ]}
          >
            {/* ==================================================
                TITLE
            ================================================== */}

            <View
              style={
                styles.converterHeader
              }
            >
              <View
                style={
                  styles.titleArea
                }
              >
                <Text
                  style={[
                    styles.converterTitle,
                    {
                      color:
                        theme.colors.text,
                    },
                  ]}
                  allowFontScaling={false}
                >
                  Currency Converter
                </Text>

                <Text
                  style={[
                    styles.converterSubtitle,
                    {
                      color:
                        theme.colors.textMuted,
                    },
                  ]}
                  allowFontScaling={false}
                >
                  Calculate easily and get
                  instant result
                </Text>
              </View>

              <View
                style={[
                  styles.calculatorIcon,
                  {
                    backgroundColor:
                      theme.colors.primarySoft,
                  },
                ]}
              >
                <Ionicons
                  name="calculator-outline"
                  size={20}
                  color={
                    theme.colors.primary
                  }
                />
              </View>
            </View>

            {/* ==================================================
                YOU SEND
            ================================================== */}

            <View
              style={[
                styles.amountCard,
                {
                  backgroundColor:
                    theme.colors.elevated,
                  borderColor:
                    theme.colors.border,
                },
              ]}
            >
              <View
                style={styles.labelRow}
              >
                <Text
                  style={[
                    styles.label,
                    {
                      color:
                        theme.colors.primary,
                    },
                  ]}
                  allowFontScaling={false}
                >
                  YOU SEND
                </Text>

                {amount.length > 0 && (
                  <Pressable
                    onPress={clearAmount}
                    hitSlop={8}
                  >
                    <Ionicons
                      name="close-circle"
                      size={17}
                      color={
                        theme.colors.textMuted
                      }
                    />
                  </Pressable>
                )}
              </View>

              <View
                style={styles.amountRow}
              >
                <View
                  style={
                    styles.currencyInfo
                  }
                >
                  <Text
                    style={styles.inputFlag}
                  >
                    {fromFlag}
                  </Text>

                  <View>
                    <Text
                      style={[
                        styles.inputCode,
                        {
                          color:
                            theme.colors.text,
                        },
                      ]}
                      allowFontScaling={
                        false
                      }
                    >
                      {fromCurrency}
                    </Text>

                    <Text
                      style={[
                        styles.inputName,
                        {
                          color:
                            theme.colors.textMuted,
                        },
                      ]}
                      allowFontScaling={
                        false
                      }
                    >
                      {fromName}
                    </Text>
                  </View>
                </View>

                <TextInput
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  selectTextOnFocus
                  blurOnSubmit={false}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textMuted}
                  selectionColor={theme.colors.primary}
                  cursorColor={theme.colors.primary}
                  inputAccessoryViewID={
                    Platform.OS === 'ios'
                      ? inputAccessoryViewID
                      : undefined
                  }
                  style={[
                    styles.amountInput,
                    {
                      color: theme.colors.text,
                    },
                  ]}
                  allowFontScaling={false}
                />

                {Platform.OS === 'ios' && (
                  <InputAccessoryView
                    nativeID={inputAccessoryViewID}
                  >
                    <View
                      style={[
                        styles.keyboardAccessory,
                        {
                          backgroundColor: theme.colors.surface,
                          borderTopColor: theme.colors.border,
                        },
                      ]}
                    >
                      <Pressable
                        onPress={Keyboard.dismiss}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss keyboard"
                        style={({ pressed }) => [
                          styles.keyboardDismissButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={21}
                          color={theme.colors.textMuted}
                        />
                      </Pressable>
                    </View>
                  </InputAccessoryView>
                )}
              </View>
            </View>

            {/* ==================================================
                SWAP
            ================================================== */}

            <View
              style={styles.swapArea}
            >
              <View
                style={[
                  styles.swapLine,
                  {
                    backgroundColor:
                      theme.colors.border,
                  },
                ]}
              />

              <Pressable
                onPress={swapCurrencies}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.centerSwap,
                  {
                    backgroundColor:
                      theme.colors.primary,
                    borderColor:
                      theme.colors.surface,
                  },
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Ionicons
                  name="swap-vertical"
                  size={21}
                  color="#FFFFFF"
                />
              </Pressable>
            </View>

            {/* ==================================================
                YOU RECEIVE
            ================================================== */}

            <View
              style={[
                styles.amountCard,
                {
                  backgroundColor:
                    theme.colors.elevated,
                  borderColor:
                    theme.colors.border,
                },
              ]}
            >
              <View
                style={styles.labelRow}
              >
                <Text
                  style={[
                    styles.label,
                    {
                      color:
                        theme.colors.primary,
                    },
                  ]}
                  allowFontScaling={false}
                >
                  YOU RECEIVE
                </Text>
              </View>

              <View
                style={styles.amountRow}
              >
                <View
                  style={
                    styles.currencyInfo
                  }
                >
                  <Text
                    style={styles.inputFlag}
                  >
                    {toFlag}
                  </Text>

                  <View>
                    <Text
                      style={[
                        styles.inputCode,
                        {
                          color:
                            theme.colors.text,
                        },
                      ]}
                      allowFontScaling={
                        false
                      }
                    >
                      {toCurrency}
                    </Text>

                    <Text
                      style={[
                        styles.inputName,
                        {
                          color:
                            theme.colors.textMuted,
                        },
                      ]}
                      allowFontScaling={
                        false
                      }
                    >
                      {toName}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.resultAmount,
                    {
                      color:
                        theme.colors.primary,
                    },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  allowFontScaling={false}
                >
                  {formatNumber(calculatedAmount)}
                </Text>
              </View>
            </View>

            {/* ==================================================
                RATE INFORMATION
            ================================================== */}

            <View
              style={styles.rateInfo}
            >
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={
                  theme.colors.primary
                }
              />

              <Text
                style={[
                  styles.rateInfoText,
                  {
                    color:
                      theme.colors.textMuted,
                  },
                ]}
                allowFontScaling={false}
              >
                1 {fromCurrency} ={' '}
                {formatRate(rateValue)}{' '}
                {toCurrency}
              </Text>
            </View>

            {/* ==================================================
                CALCULATE BUTTON
            ================================================== */}

            <Pressable
              onPress={Keyboard.dismiss}
              style={({ pressed }) => [
                styles.calculateButton,
                {
                  backgroundColor:
                    theme.colors.primary,
                },
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="calculator"
                size={17}
                color="#FFFFFF"
              />

              <Text
                style={styles.calculateText}
                allowFontScaling={false}
              >
                Calculate Amount
              </Text>
            </Pressable>

            {/* ==================================================
                SECURE & RELIABLE
            ================================================== */}

            <View
              style={[
                styles.trustCard,
                {
                  backgroundColor:
                    theme.colors.primarySoft,
                  borderColor:
                    theme.colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.trustIcon,
                  {
                    backgroundColor:
                      theme.colors.surface,
                  },
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={
                    theme.colors.primary
                  }
                />
              </View>

              <View
                style={
                  styles.trustContent
                }
              >
                <Text
                  style={[
                    styles.trustTitle,
                    {
                      color:
                        theme.colors.text,
                    },
                  ]}
                  allowFontScaling={false}
                >
                  Secure & Reliable
                </Text>

                <Text
                  style={[
                    styles.trustSubtitle,
                    {
                      color:
                        theme.colors.textMuted,
                    },
                  ]}
                  allowFontScaling={false}
                >
                  Exchange rates are updated
                  in real time
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={17}
                color={
                  theme.colors.primary
                }
              />
            </View>
          </View>

          <View
            style={styles.bottomSpace}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ==============================================================
   STYLES
============================================================== */

const createStyles = (colors: {
  background: string;
  surface: string;
  elevated: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
}) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    keyboard: {
      flex: 1,
    },

    scrollContent: {
      paddingBottom: 20,
    },

    /* ==========================================================
       HERO
    ========================================================== */

    hero: {
      width: '100%',
      overflow: 'hidden',

      borderBottomLeftRadius: 34,
      borderBottomRightRadius: 34,
    },

    heroImage: {
      borderBottomLeftRadius: 34,
      borderBottomRightRadius: 34,
    },

    heroOverlay: {
      flex: 1,

      paddingHorizontal: 19,
      paddingTop: 13,
      paddingBottom: 16,
    },

    /* ==========================================================
       HEADER
    ========================================================== */

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    headerLeft: {
      flex: 1,

      flexDirection: 'row',
      alignItems: 'center',
    },

    appIcon: {
      width: 43,
      height: 43,

      borderRadius: 22,

      backgroundColor: '#1478F2',

      alignItems: 'center',
      justifyContent: 'center',

      marginRight: 9,

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.22,
      shadowRadius: 8,

      elevation: 6,
    },

    headerText: {
      flex: 1,
    },

    heroTitle: {
      color: '#FFFFFF',

      fontSize: 23,
      lineHeight: 28,

      fontWeight: '900',

      letterSpacing: -0.6,

      textShadowColor:
        'rgba(0,0,0,0.48)',

      textShadowOffset: {
        width: 0,
        height: 2,
      },

      textShadowRadius: 5,
    },

    updatedRow: {
      flexDirection: 'row',
      alignItems: 'center',

      marginTop: 1,
    },

    liveDot: {
      width: 6,
      height: 6,

      borderRadius: 3,

      backgroundColor:
        '#57F39A',

      marginRight: 5,
    },

    updatedText: {
      color:
        'rgba(255,255,255,0.92)',

      fontSize: 9,
      lineHeight: 12,

      fontWeight: '500',

      textShadowColor:
        'rgba(0,0,0,0.42)',

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 3,
    },

    refreshButton: {
      width: 39,
      height: 39,

      borderRadius: 20,

      backgroundColor:
        'rgba(7,24,42,0.43)',

      borderWidth: 1,

      borderColor:
        'rgba(255,255,255,0.28)',

      alignItems: 'center',
      justifyContent: 'center',
    },

    /* ==========================================================
       CURRENCY PAIR
    ========================================================== */

    currencyPair: {
      flexDirection: 'row',
      alignItems: 'center',

      marginTop: 18,
    },

    currencySide: {
      flex: 1,
    },

    leftSide: {
      alignItems: 'flex-start',
    },

    rightSide: {
      alignItems: 'flex-end',
    },

    flag: {
      fontSize: 25,
      marginBottom: 2,
    },

    currencyCode: {
      color: '#FFFFFF',

      fontSize: 18,
      lineHeight: 22,

      fontWeight: '900',

      textShadowColor:
        'rgba(0,0,0,0.45)',

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 4,
    },

    currencyName: {
      color:
        'rgba(255,255,255,0.84)',

      fontSize: 8,
      lineHeight: 11,

      marginTop: 1,

      textShadowColor:
        'rgba(0,0,0,0.40)',

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 3,
    },

    heroSwap: {
      width: 47,
      height: 47,

      borderRadius: 24,

      backgroundColor:
        'rgba(255,255,255,0.97)',

      alignItems: 'center',
      justifyContent: 'center',

      marginHorizontal: 9,

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.20,
      shadowRadius: 8,

      elevation: 6,
    },

    /* ==========================================================
       RATE
    ========================================================== */

    rateArea: {
      alignItems: 'center',

      marginTop: 8,
    },

    rateLabel: {
      color:
        'rgba(255,255,255,0.95)',

      fontSize: 11,
      lineHeight: 15,

      fontWeight: '700',

      textShadowColor:
        'rgba(0,0,0,0.42)',

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 3,
    },

    rateRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },

    rateNumber: {
      color: '#FFFFFF',

      fontSize: 43,
      lineHeight: 48,

      fontWeight: '900',

      letterSpacing: -1.6,

      textShadowColor:
        'rgba(0,0,0,0.48)',

      textShadowOffset: {
        width: 0,
        height: 2,
      },

      textShadowRadius: 6,
    },

    rateCurrency: {
      color: '#FFFFFF',

      fontSize: 15,
      lineHeight: 20,

      fontWeight: '900',

      marginLeft: 5,

      textShadowColor:
        'rgba(0,0,0,0.42)',

      textShadowOffset: {
        width: 0,
        height: 1,
      },

      textShadowRadius: 3,
    },

    /* ==========================================================
       CHANGE
    ========================================================== */

    changeBadge: {
      alignSelf: 'center',

      flexDirection: 'row',
      alignItems: 'center',

      backgroundColor:
        'rgba(232,252,240,0.97)',

      borderRadius: 18,

      paddingHorizontal: 12,
      paddingVertical: 5,

      marginTop: 5,
    },

    changeText: {
      color: '#078A50',

      fontSize: 10,
      lineHeight: 13,

      fontWeight: '800',

      marginLeft: 4,
    },

    /* ==========================================================
       CONVERTER
    ========================================================== */

    converter: {
      marginHorizontal: 12,

      marginTop: -15,

      borderRadius: 29,

      paddingHorizontal: 15,
      paddingTop: 15,
      paddingBottom: 14,

      borderWidth: 1,

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.12,
      shadowRadius: 17,

      elevation: 8,
    },

    converterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',

      marginBottom: 10,
    },

    titleArea: {
      flex: 1,
      paddingRight: 8,
    },

    converterTitle: {
      fontSize: 19,
      lineHeight: 24,

      fontWeight: '900',

      letterSpacing: -0.5,
    },

    converterSubtitle: {
      fontSize: 9,
      lineHeight: 12,

      marginTop: 2,
    },

    calculatorIcon: {
      width: 40,
      height: 40,

      borderRadius: 13,

      alignItems: 'center',
      justifyContent: 'center',
    },

    /* ==========================================================
       AMOUNT CARDS
    ========================================================== */

    amountCard: {
      minHeight: 88,

      borderRadius: 17,

      borderWidth: 1,

      paddingHorizontal: 12,
      paddingVertical: 9,
    },

    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',

      marginBottom: 3,
    },

    label: {
      fontSize: 9,
      lineHeight: 12,

      fontWeight: '900',

      letterSpacing: 0.5,
    },

    amountRow: {
      flex: 1,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    currencyInfo: {
      flexDirection: 'row',
      alignItems: 'center',

      flexShrink: 1,
    },

    inputFlag: {
      fontSize: 25,

      marginRight: 8,
    },

    inputCode: {
      fontSize: 17,
      lineHeight: 21,

      fontWeight: '900',
    },

    inputName: {
      fontSize: 8,
      lineHeight: 11,

      marginTop: 1,
    },

    amountInput: {
      flex: 1,

      minWidth: 85,

      fontSize: 24,
      lineHeight: 29,

      fontWeight: '900',

      textAlign: 'right',

      paddingLeft: 7,
      paddingVertical: 0,
    },

    keyboardAccessory: {
      height: 42,

      borderTopWidth: 1,

      alignItems: 'flex-end',
      justifyContent: 'center',

      paddingHorizontal: 12,
    },

    keyboardDismissButton: {
      width: 36,
      height: 36,

      borderRadius: 18,

      alignItems: 'center',
      justifyContent: 'center',
    },

    resultAmount: {
      flex: 1,

      minWidth: 85,

      fontSize: 23,
      lineHeight: 28,

      fontWeight: '900',

      textAlign: 'right',

      paddingLeft: 7,
    },

    /* ==========================================================
       CENTER SWAP
    ========================================================== */

    swapArea: {
      height: 27,

      alignItems: 'center',
      justifyContent: 'center',

      position: 'relative',

      zIndex: 10,
    },

    swapLine: {
      position: 'absolute',

      left: 12,
      right: 12,

      height: 1,
    },

    centerSwap: {
      width: 40,
      height: 40,

      borderRadius: 20,

      alignItems: 'center',
      justifyContent: 'center',

      borderWidth: 3,

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.18,
      shadowRadius: 7,

      elevation: 7,
    },

    /* ==========================================================
       RATE INFO
    ========================================================== */

    rateInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',

      marginTop: 8,
    },

    rateInfoText: {
      fontSize: 9,
      lineHeight: 13,

      fontWeight: '600',

      marginLeft: 4,
    },

    /* ==========================================================
       CALCULATE BUTTON
    ========================================================== */

    calculateButton: {
      height: 47,

      borderRadius: 14,

      marginTop: 10,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.17,
      shadowRadius: 7,

      elevation: 6,
    },

    calculateText: {
      color: '#FFFFFF',

      fontSize: 13,
      lineHeight: 17,

      fontWeight: '900',

      marginLeft: 6,
    },

    /* ==========================================================
       TRUST
    ========================================================== */

    trustCard: {
      minHeight: 61,

      borderRadius: 16,

      borderWidth: 1,

      marginTop: 10,

      paddingHorizontal: 9,
      paddingVertical: 8,

      flexDirection: 'row',
      alignItems: 'center',
    },

    trustIcon: {
      width: 38,
      height: 38,

      borderRadius: 12,

      alignItems: 'center',
      justifyContent: 'center',

      marginRight: 9,
    },

    trustContent: {
      flex: 1,

      paddingRight: 5,
    },

    trustTitle: {
      fontSize: 12,
      lineHeight: 16,

      fontWeight: '900',
    },

    trustSubtitle: {
      fontSize: 8,
      lineHeight: 11,

      marginTop: 1,
    },

    /* ==========================================================
       PRESS
    ========================================================== */

    pressed: {
      opacity: 0.72,

      transform: [
        {
          scale: 0.97,
        },
      ],
    },

    bottomSpace: {
      height: 18,
    },
  });