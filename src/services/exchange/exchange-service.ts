import { ExchangeRateSnapshot } from '@/features/exchange/types';
import { apiRequest } from '@/services/api/client';

export async function fetchExchangeRates() {
  return apiRequest<ExchangeRateSnapshot>('/api/exchange-rate');
}
