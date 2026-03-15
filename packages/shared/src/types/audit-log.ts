export const AuditLogAction = {
  // Server
  SERVER_UPDATE: 'SERVER_UPDATE',
  // Channels
  CHANNEL_CREATE: 'CHANNEL_CREATE',
  CHANNEL_UPDATE: 'CHANNEL_UPDATE',
  CHANNEL_DELETE: 'CHANNEL_DELETE',
  // Roles
  ROLE_CREATE: 'ROLE_CREATE',
  ROLE_UPDATE: 'ROLE_UPDATE',
  ROLE_DELETE: 'ROLE_DELETE',
  // Members
  MEMBER_KICK: 'MEMBER_KICK',
  MEMBER_BAN: 'MEMBER_BAN',
  MEMBER_UNBAN: 'MEMBER_UNBAN',
  // Invites
  INVITE_CREATE: 'INVITE_CREATE',
  INVITE_DELETE: 'INVITE_DELETE',
} as const;

export type AuditLogAction = typeof AuditLogAction[keyof typeof AuditLogAction];

export interface AuditLogEntry {
  id: string;
  serverId: string;
  actorId: string;
  action: AuditLogAction;
  targetType: string | null;
  targetId: string | null;
  changes: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
  actor?: {
    id: string;
    username: string;
    discriminator: string;
    avatarUrl: string | null;
  };
}
