import type { PublicUser } from './user.js';
import type { Reaction } from './reaction.js';
import type { Embed } from './embed.js';

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string | null;
  editedAt: string | null;
  isDeleted: boolean;
  replyToId: string | null;
  replyTo?: Message | null;
  isPinned: boolean;
  pinnedAt: string | null;
  pinnedBy: string | null;
  createdAt: string;
  author?: PublicUser;
  attachments?: Attachment[];
  reactions?: Reaction[];
  embeds?: Embed[];
  webhookId?: string | null;
  webhookName?: string | null;
  webhookAvatarUrl?: string | null;

  // Client-only fields for optimistic UI
  _isPending?: boolean;
  _isFailed?: boolean;
  _tempId?: string;
}

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  url: string;
  contentType: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}
