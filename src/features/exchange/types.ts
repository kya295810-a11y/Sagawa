import { SupportedCurrency } from '@/constants/app';

export interface ExchangeRate {
  baseCurrency: SupportedCurrency;
  changeDirection?: 'down' | 'flat' | 'up';
  fetchedAt: string;
  quoteCurrency: SupportedCurrency;
  rate: number;
  sourceName: string;
}

export interface ExchangeRateSnapshot {
  rates: ExchangeRate[];
  stale: boolean;
}

export interface ExchangeProviderRate {
  id: string;
  name: string;
  rate: number;
  logoUrl: string;
  websiteUrl: string;
  displayOrder: number;
}

export interface ExchangeRateResponse {
  success?: boolean;
  data?: {
    id?: number | string | null;
    rate?: number | string | null;
    updatedAt?: string | null;
    rates?: {
      currency?: string;
      buy?: number | string;
    }[];
    providers?: (
      Omit<Partial<ExchangeProviderRate>, 'rate'> & { rate?: number | string }
    )[];
  };
}
