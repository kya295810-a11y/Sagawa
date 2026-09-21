import { ExchangeRateResponse } from '@/features/exchange/types';
import { apiRequest } from '@/services/api/client';

export async function fetchExchangeRates() {
  return apiRequest<ExchangeRateResponse>('/api/exchange-rate');
}
