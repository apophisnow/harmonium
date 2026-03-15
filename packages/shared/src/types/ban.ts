import type { PublicUser } from './user.js';

export interface Ban {
  serverId: string;
  user: PublicUser;
  reason: string | null;
  bannedBy: string;
  createdAt: string;
}
