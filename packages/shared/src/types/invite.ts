import type { PublicUser } from './user.js';
import type { Server } from './server.js';

export interface Invite {
  code: string;
  serverId: string;
  inviterId: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null;
  createdAt: string;
  server?: Pick<Server, 'id' | 'name' | 'iconUrl'>;
  inviter?: PublicUser;
}
