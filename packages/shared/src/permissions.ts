export const Permission = {
  ADMINISTRATOR:    1n << 0n,
  MANAGE_SERVER:    1n << 1n,
  MANAGE_CHANNELS:  1n << 2n,
  MANAGE_ROLES:     1n << 3n,
  MANAGE_MESSAGES:  1n << 4n,
  SEND_MESSAGES:    1n << 5n,
  READ_MESSAGES:    1n << 6n,
  CONNECT:          1n << 7n,  // join voice
  SPEAK:            1n << 8n,  // speak in voice
  CREATE_INVITE:    1n << 9n,
  KICK_MEMBERS:     1n << 10n,
  BAN_MEMBERS:      1n << 11n,
  ATTACH_FILES:     1n << 12n,
  MENTION_EVERYONE: 1n << 13n,
  STREAM:           1n << 14n,  // share screen in voice
} as const;

export type PermissionFlag = typeof Permission[keyof typeof Permission];

// All permissions combined
export const ALL_PERMISSIONS = Object.values(Permission).reduce((acc, p) => acc | p, 0n);

// Default @everyone permissions
export const DEFAULT_PERMISSIONS =
  Permission.SEND_MESSAGES |
  Permission.READ_MESSAGES |
  Permission.CONNECT |
  Permission.SPEAK |
  Permission.STREAM |
  Permission.CREATE_INVITE |
  Permission.ATTACH_FILES;

export function hasPermission(permissions: bigint, flag: bigint): boolean {
  if ((permissions & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return true;
  return (permissions & flag) === flag;
}

export function addPermission(permissions: bigint, flag: bigint): bigint {
  return permissions | flag;
}

export function removePermission(permissions: bigint, flag: bigint): bigint {
  return permissions & ~flag;
}

// Calculate effective channel permissions with overrides
export function computeChannelPermissions(
  basePermissions: bigint,
  overrides: Array<{ allow: bigint; deny: bigint }>
): bigint {
  if (hasPermission(basePermissions, Permission.ADMINISTRATOR)) return ALL_PERMISSIONS;

  let permissions = basePermissions;
  for (const override of overrides) {
    permissions &= ~override.deny;
    permissions |= override.allow;
  }
  return permissions;
}

// Serialize bigint to string for JSON
export function permissionToString(permission: bigint): string {
  return permission.toString();
}

// Parse string back to bigint
export function stringToPermission(str: string): bigint {
  return BigInt(str);
}
