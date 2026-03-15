export const SERVER_CATEGORIES = [
  'Gaming',
  'Music',
  'Education',
  'Science & Tech',
  'Entertainment',
  'Community',
  'Creative Arts',
  'Sports',
  'Finance',
  'Other',
] as const;

export type ServerCategory = (typeof SERVER_CATEGORIES)[number];

export interface DiscoveryServer {
  id: string;
  name: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  categories: string[];
  memberCount: number;
  primaryLanguage: string;
}

export interface DiscoveryResponse {
  servers: DiscoveryServer[];
  total: number;
  page: number;
  limit: number;
}

export interface DiscoverySettings {
  isDiscoverable: boolean;
  description: string | null;
  categories: string[];
  vanityUrl: string | null;
  bannerUrl: string | null;
  primaryLanguage: string;
}
