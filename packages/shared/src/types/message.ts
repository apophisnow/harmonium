import type { PublicUser } from './user.js';

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string | null;
  editedAt: string | null;
  isDeleted: boolean;
  createdAt: string;
  author?: PublicUser;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  url: string;
  contentType: string | null;
  sizeBytes: number;
  createdAt: string;
}
