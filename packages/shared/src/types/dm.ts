import type { PublicUser } from './user.js';
import type { Message } from './message.js';

export interface DMChannel {
  id: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DMChannelWithUser {
  id: string;
  /** The other participant in the DM */
  user: PublicUser;
  lastMessage?: Message;
  unreadCount: number;
}

export interface DMMessage {
  id: string;
  dmChannelId: string;
  authorId: string;
  content: string | null;
  isDeleted: boolean;
  createdAt: string;
  author?: PublicUser;
}
