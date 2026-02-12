import type { PublicUser } from './user.js';

export interface Server {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  defaultTheme: string | null;
  defaultMode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServerMember {
  serverId: string;
  userId: string;
  nickname: string | null;
  joinedAt: string;
  user?: PublicUser;     // populated on fetch
  roles?: string[];      // role IDs
}
