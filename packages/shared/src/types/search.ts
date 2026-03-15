import type { Message } from './message.js';

export interface SearchResult {
  message: Message;
  channelName: string;
  serverName: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
}

export interface SearchFilters {
  query: string;
  serverId?: string;
  channelId?: string;
  authorId?: string;
  before?: string;   // ISO date
  after?: string;    // ISO date
  limit?: number;
  offset?: number;
}
