import type { PublicUser } from './user.js';

export interface DmChannel {
  id: string;
  type: 'dm' | 'group_dm';
  name: string | null;           // null for 1:1 DMs (display other user's name), set for group DMs
  iconUrl: string | null;        // group DM icon
  ownerId: string | null;        // group DM owner
  recipients: PublicUser[];      // other participants (not including self)
  lastMessageId: string | null;  // for sorting by recent activity
  isOpen: boolean;               // whether the current user has this DM "open"
  createdAt: string;
}
