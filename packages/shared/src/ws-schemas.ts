import { z } from 'zod';

// ===== Reusable sub-schemas =====

const userStatusSchema = z.enum(['online', 'idle', 'dnd', 'offline']);

const publicUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  discriminator: z.string(),
  avatarUrl: z.string().nullable(),
  aboutMe: z.string().nullable(),
  status: userStatusSchema,
  customStatus: z.string().nullable(),
  theme: z.string().nullable().optional(),
  mode: z.string().nullable().optional(),
  frequentEmoji: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const reactionSchema = z.object({
  emoji: z.string(),
  count: z.number(),
  userIds: z.array(z.string()),
});

const embedSchema = z.object({
  id: z.string(),
  url: z.string(),
  type: z.enum(['link', 'image', 'video', 'rich']),
  title: z.string().nullable(),
  description: z.string().nullable(),
  siteName: z.string().nullable(),
  imageUrl: z.string().nullable(),
  imageWidth: z.number().nullable(),
  imageHeight: z.number().nullable(),
  color: z.string().nullable(),
});

const attachmentSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  filename: z.string(),
  url: z.string(),
  contentType: z.string().nullable(),
  sizeBytes: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  createdAt: z.string(),
});

const messageSchema: z.ZodType = z.object({
  id: z.string(),
  channelId: z.string(),
  authorId: z.string(),
  content: z.string().nullable(),
  editedAt: z.string().nullable(),
  isDeleted: z.boolean(),
  replyToId: z.string().nullable(),
  replyTo: z.lazy(() => messageSchema).nullable().optional(),
  isPinned: z.boolean(),
  pinnedAt: z.string().nullable(),
  pinnedBy: z.string().nullable(),
  createdAt: z.string(),
  author: publicUserSchema.optional(),
  attachments: z.array(attachmentSchema).optional(),
  reactions: z.array(reactionSchema).optional(),
  embeds: z.array(embedSchema).optional(),
  webhookId: z.string().nullable().optional(),
  webhookName: z.string().nullable().optional(),
  webhookAvatarUrl: z.string().nullable().optional(),
  _isPending: z.boolean().optional(),
  _isFailed: z.boolean().optional(),
  _tempId: z.string().optional(),
});

const channelTypeSchema = z.enum(['text', 'voice']);

const channelSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  categoryId: z.string().nullable(),
  name: z.string(),
  type: channelTypeSchema,
  topic: z.string().nullable(),
  position: z.number(),
  isPrivate: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isThread: z.boolean().optional(),
  parentChannelId: z.string().nullable().optional(),
  originMessageId: z.string().nullable().optional(),
  threadArchived: z.boolean().optional(),
  threadArchivedAt: z.string().nullable().optional(),
  lastMessageAt: z.string().nullable().optional(),
  messageCount: z.number().optional(),
});

const serverSchema = z.object({
  id: z.string(),
  name: z.string(),
  iconUrl: z.string().nullable(),
  ownerId: z.string(),
  defaultTheme: z.string().nullable(),
  defaultMode: z.string().nullable(),
  isDiscoverable: z.boolean(),
  description: z.string().nullable(),
  categories: z.array(z.string()),
  vanityUrl: z.string().nullable(),
  memberCount: z.number(),
  bannerUrl: z.string().nullable(),
  primaryLanguage: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const serverMemberSchema = z.object({
  serverId: z.string(),
  userId: z.string(),
  nickname: z.string().nullable(),
  joinedAt: z.string(),
  user: publicUserSchema.optional(),
  roles: z.array(z.string()).optional(),
});

const roleSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  name: z.string(),
  color: z.number().nullable(),
  position: z.number(),
  permissions: z.string(),
  isDefault: z.boolean(),
  createdAt: z.string(),
});

const readStateSchema = z.object({
  channelId: z.string(),
  lastReadMessageId: z.string().nullable(),
  mentionCount: z.number(),
});

const dmChannelSchema = z.object({
  id: z.string(),
  type: z.enum(['dm', 'group_dm']),
  name: z.string().nullable(),
  iconUrl: z.string().nullable(),
  ownerId: z.string().nullable(),
  recipients: z.array(publicUserSchema),
  lastMessageId: z.string().nullable(),
  isOpen: z.boolean(),
  createdAt: z.string(),
});

const relationshipTypeSchema = z.enum([
  'friend',
  'pending_outgoing',
  'pending_incoming',
  'blocked',
  'ignored',
]);

const relationshipSchema = z.object({
  user: publicUserSchema,
  type: relationshipTypeSchema,
  createdAt: z.string(),
});

const producerTypeSchema = z.enum(['audio', 'screenShare', 'webcam']);

// ===== Server-to-Client Event Data Schemas =====

export const helloDataSchema = z.object({
  heartbeatInterval: z.number(),
  sessionId: z.string(),
});

export const heartbeatAckDataSchema = z.object({});

export const readyDataSchema = z.object({
  user: publicUserSchema,
  servers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    iconUrl: z.string().nullable(),
  })),
  sessionId: z.string(),
  presences: z.array(z.object({
    userId: z.string(),
    status: userStatusSchema,
  })),
  readStates: z.array(readStateSchema),
  dmChannels: z.array(dmChannelSchema),
});

export const messageCreateDataSchema = z.object({
  message: messageSchema,
});

export const messageUpdateDataSchema = z.object({
  message: z.object({
    id: z.string(),
    channelId: z.string(),
  }).passthrough(),
});

export const messageDeleteDataSchema = z.object({
  id: z.string(),
  channelId: z.string(),
});

export const typingStartDataSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  username: z.string(),
  timestamp: z.number(),
});

export const presenceUpdateDataSchema = z.object({
  userId: z.string(),
  status: userStatusSchema,
});

export const memberJoinDataSchema = z.object({
  serverId: z.string(),
  member: serverMemberSchema,
});

export const memberLeaveDataSchema = z.object({
  serverId: z.string(),
  userId: z.string(),
});

export const memberUpdateDataSchema = z.object({
  serverId: z.string(),
  userId: z.string(),
  roles: z.array(z.string()),
});

export const memberBanDataSchema = z.object({
  serverId: z.string(),
  userId: z.string(),
});

export const roleUpdateDataSchema = z.object({
  serverId: z.string(),
  role: roleSchema,
});

export const userUpdateDataSchema = z.object({
  user: publicUserSchema,
});

export const channelCreateDataSchema = z.object({
  channel: channelSchema,
});

export const channelUpdateDataSchema = z.object({
  channel: channelSchema,
});

export const channelDeleteDataSchema = z.object({
  channelId: z.string(),
  serverId: z.string(),
});

export const serverUpdateDataSchema = z.object({
  server: serverSchema,
});

export const serverDeleteDataSchema = z.object({
  serverId: z.string(),
});

export const voiceStateUpdateDataSchema = z.object({
  userId: z.string(),
  channelId: z.string(),
  serverId: z.string(),
  selfMute: z.boolean(),
  selfDeaf: z.boolean(),
  joinedAt: z.string(),
  username: z.string(),
});

export const newProducerDataSchema = z.object({
  producerId: z.string(),
  userId: z.string(),
  kind: z.enum(['audio', 'video']),
  producerType: producerTypeSchema,
  channelId: z.string(),
  serverId: z.string(),
});

export const producerClosedDataSchema = z.object({
  producerId: z.string(),
  userId: z.string(),
  kind: z.enum(['audio', 'video']),
  producerType: producerTypeSchema,
  channelId: z.string(),
  serverId: z.string(),
});

export const reactionAddDataSchema = z.object({
  channelId: z.string(),
  messageId: z.string(),
  userId: z.string(),
  emoji: z.string(),
});

export const reactionRemoveDataSchema = z.object({
  channelId: z.string(),
  messageId: z.string(),
  userId: z.string(),
  emoji: z.string(),
});

export const dmChannelCreateDataSchema = z.object({
  channel: dmChannelSchema,
});

export const dmChannelUpdateDataSchema = z.object({
  channel: dmChannelSchema,
});

export const relationshipUpdateDataSchema = z.object({
  relationship: relationshipSchema,
});

export const relationshipRemoveDataSchema = z.object({
  userId: z.string(),
});

export const messagePinDataSchema = z.object({
  channelId: z.string(),
  message: messageSchema,
});

export const messageUnpinDataSchema = z.object({
  channelId: z.string(),
  messageId: z.string(),
});

export const messageEmbedUpdateDataSchema = z.object({
  channelId: z.string(),
  messageId: z.string(),
  embeds: z.array(embedSchema),
});

export const threadCreateDataSchema = z.object({
  thread: channelSchema,
});

export const threadUpdateDataSchema = z.object({
  thread: channelSchema,
});

export const threadDeleteDataSchema = z.object({
  threadId: z.string(),
  serverId: z.string(),
  parentChannelId: z.string(),
});

export const errorDataSchema = z.object({
  code: z.number(),
  message: z.string(),
});

// ===== Full event schemas (op + d) =====

export const serverEventSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('HELLO'), d: helloDataSchema }),
  z.object({ op: z.literal('HEARTBEAT_ACK'), d: heartbeatAckDataSchema }),
  z.object({ op: z.literal('READY'), d: readyDataSchema }),
  z.object({ op: z.literal('MESSAGE_CREATE'), d: messageCreateDataSchema }),
  z.object({ op: z.literal('MESSAGE_UPDATE'), d: messageUpdateDataSchema }),
  z.object({ op: z.literal('MESSAGE_DELETE'), d: messageDeleteDataSchema }),
  z.object({ op: z.literal('TYPING_START'), d: typingStartDataSchema }),
  z.object({ op: z.literal('PRESENCE_UPDATE'), d: presenceUpdateDataSchema }),
  z.object({ op: z.literal('USER_UPDATE'), d: userUpdateDataSchema }),
  z.object({ op: z.literal('MEMBER_JOIN'), d: memberJoinDataSchema }),
  z.object({ op: z.literal('MEMBER_LEAVE'), d: memberLeaveDataSchema }),
  z.object({ op: z.literal('MEMBER_UPDATE'), d: memberUpdateDataSchema }),
  z.object({ op: z.literal('MEMBER_BAN'), d: memberBanDataSchema }),
  z.object({ op: z.literal('ROLE_UPDATE'), d: roleUpdateDataSchema }),
  z.object({ op: z.literal('CHANNEL_CREATE'), d: channelCreateDataSchema }),
  z.object({ op: z.literal('CHANNEL_UPDATE'), d: channelUpdateDataSchema }),
  z.object({ op: z.literal('CHANNEL_DELETE'), d: channelDeleteDataSchema }),
  z.object({ op: z.literal('SERVER_UPDATE'), d: serverUpdateDataSchema }),
  z.object({ op: z.literal('SERVER_DELETE'), d: serverDeleteDataSchema }),
  z.object({ op: z.literal('VOICE_STATE_UPDATE'), d: voiceStateUpdateDataSchema }),
  z.object({ op: z.literal('NEW_PRODUCER'), d: newProducerDataSchema }),
  z.object({ op: z.literal('PRODUCER_CLOSED'), d: producerClosedDataSchema }),
  z.object({ op: z.literal('REACTION_ADD'), d: reactionAddDataSchema }),
  z.object({ op: z.literal('REACTION_REMOVE'), d: reactionRemoveDataSchema }),
  z.object({ op: z.literal('DM_CHANNEL_CREATE'), d: dmChannelCreateDataSchema }),
  z.object({ op: z.literal('DM_CHANNEL_UPDATE'), d: dmChannelUpdateDataSchema }),
  z.object({ op: z.literal('RELATIONSHIP_UPDATE'), d: relationshipUpdateDataSchema }),
  z.object({ op: z.literal('RELATIONSHIP_REMOVE'), d: relationshipRemoveDataSchema }),
  z.object({ op: z.literal('MESSAGE_PIN'), d: messagePinDataSchema }),
  z.object({ op: z.literal('MESSAGE_UNPIN'), d: messageUnpinDataSchema }),
  z.object({ op: z.literal('MESSAGE_EMBED_UPDATE'), d: messageEmbedUpdateDataSchema }),
  z.object({ op: z.literal('THREAD_CREATE'), d: threadCreateDataSchema }),
  z.object({ op: z.literal('THREAD_UPDATE'), d: threadUpdateDataSchema }),
  z.object({ op: z.literal('THREAD_DELETE'), d: threadDeleteDataSchema }),
  z.object({ op: z.literal('ERROR'), d: errorDataSchema }),
]);

export type ServerEventParsed = z.infer<typeof serverEventSchema>;
