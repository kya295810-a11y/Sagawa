import { PaginatedNewsResponse } from '@/features/news/types';
import { apiRequest } from '@/services/api/client';

export async function fetchNews(cursor?: string | null) {
  const queryString = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequest<PaginatedNewsResponse>(`/api/news${queryString}`);
}
