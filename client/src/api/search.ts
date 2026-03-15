import type { SearchFilters, SearchResponse } from '@harmonium/shared';
import { apiClient } from './client.js';

export async function searchMessages(filters: SearchFilters): Promise<SearchResponse> {
  const response = await apiClient.get<SearchResponse>('/search/messages', {
    params: filters,
  });
  return response.data;
}
