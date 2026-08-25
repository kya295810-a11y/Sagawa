export const APP_METADATA = {
  supportedCurrencies: ['MYR', 'MMK'] as const,
  supportedLanguages: ['en', 'my'] as const,
  temporaryDisplayName: 'Sagawa',
} as const;

export type SupportedLanguage = (typeof APP_METADATA.supportedLanguages)[number];
export type SupportedCurrency = (typeof APP_METADATA.supportedCurrencies)[number];
