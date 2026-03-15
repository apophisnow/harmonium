import type { PublicUser } from './user.js';

export type RelationshipType = 'friend' | 'pending_outgoing' | 'pending_incoming' | 'blocked';

export interface Relationship {
  user: PublicUser;
  type: RelationshipType;
  createdAt: string;
}
