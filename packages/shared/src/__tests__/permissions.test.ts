import { describe, it, expect } from 'vitest';

import {
  Permission,
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  hasPermission,
  addPermission,
  removePermission,
  computeChannelPermissions,
  permissionToString,
  stringToPermission,
} from '../permissions.js';

describe('Permission constants', () => {
  it('each permission flag is a unique power of 2 (no two flags share bits)', () => {
    const flags = Object.values(Permission);
    for (let i = 0; i < flags.length; i++) {
      for (let j = i + 1; j < flags.length; j++) {
        expect(flags[i] & flags[j]).toBe(0n);
      }
    }
  });

  it('there are exactly 15 permission flags', () => {
    expect(Object.keys(Permission).length).toBe(15);
  });
});

describe('ALL_PERMISSIONS', () => {
  it('includes every single permission flag', () => {
    for (const flag of Object.values(Permission)) {
      expect(ALL_PERMISSIONS & flag).toBe(flag);
    }
  });

  it('has exactly the right bits set (no extra bits)', () => {
    const expected = Object.values(Permission).reduce((acc, p) => acc | p, 0n);
    expect(ALL_PERMISSIONS).toBe(expected);
  });
});

describe('DEFAULT_PERMISSIONS', () => {
  it('includes SEND_MESSAGES, READ_MESSAGES, CONNECT, SPEAK, CREATE_INVITE, ATTACH_FILES', () => {
    const expectedFlags = [
      Permission.SEND_MESSAGES,
      Permission.READ_MESSAGES,
      Permission.CONNECT,
      Permission.SPEAK,
      Permission.CREATE_INVITE,
      Permission.ATTACH_FILES,
    ];
    for (const flag of expectedFlags) {
      expect(DEFAULT_PERMISSIONS & flag).toBe(flag);
    }
  });

  it('does NOT include ADMINISTRATOR, MANAGE_SERVER, MANAGE_CHANNELS, MANAGE_ROLES, MANAGE_MESSAGES, KICK_MEMBERS, BAN_MEMBERS, MENTION_EVERYONE', () => {
    const excludedFlags = [
      Permission.ADMINISTRATOR,
      Permission.MANAGE_SERVER,
      Permission.MANAGE_CHANNELS,
      Permission.MANAGE_ROLES,
      Permission.MANAGE_MESSAGES,
      Permission.KICK_MEMBERS,
      Permission.BAN_MEMBERS,
      Permission.MENTION_EVERYONE,
    ];
    for (const flag of excludedFlags) {
      expect(DEFAULT_PERMISSIONS & flag).toBe(0n);
    }
  });
});

describe('hasPermission', () => {
  it('returns true when the flag is present', () => {
    const perms = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
    expect(hasPermission(perms, Permission.SEND_MESSAGES)).toBe(true);
    expect(hasPermission(perms, Permission.READ_MESSAGES)).toBe(true);
  });

  it('returns false when the flag is absent', () => {
    const perms = Permission.SEND_MESSAGES;
    expect(hasPermission(perms, Permission.READ_MESSAGES)).toBe(false);
    expect(hasPermission(perms, Permission.ADMINISTRATOR)).toBe(false);
  });

  it('ADMINISTRATOR flag grants any other permission', () => {
    const perms = Permission.ADMINISTRATOR;
    for (const flag of Object.values(Permission)) {
      expect(hasPermission(perms, flag)).toBe(true);
    }
  });

  it('works with combined permissions (multiple flags checked at once)', () => {
    const perms =
      Permission.SEND_MESSAGES |
      Permission.READ_MESSAGES |
      Permission.CONNECT;
    const combined = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
    expect(hasPermission(perms, combined)).toBe(true);

    const partiallyMissing = Permission.SEND_MESSAGES | Permission.BAN_MEMBERS;
    expect(hasPermission(perms, partiallyMissing)).toBe(false);
  });
});

describe('addPermission', () => {
  it('adds a new flag to an existing permission set', () => {
    const perms = Permission.READ_MESSAGES;
    const updated = addPermission(perms, Permission.SEND_MESSAGES);
    expect(updated & Permission.READ_MESSAGES).toBe(Permission.READ_MESSAGES);
    expect(updated & Permission.SEND_MESSAGES).toBe(Permission.SEND_MESSAGES);
  });

  it('is idempotent -- adding an already-present flag does not change the value', () => {
    const perms = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
    const updated = addPermission(perms, Permission.SEND_MESSAGES);
    expect(updated).toBe(perms);
  });

  it('can combine multiple flags by successive additions', () => {
    let perms = 0n;
    perms = addPermission(perms, Permission.SEND_MESSAGES);
    perms = addPermission(perms, Permission.READ_MESSAGES);
    perms = addPermission(perms, Permission.CONNECT);
    expect(perms).toBe(
      Permission.SEND_MESSAGES | Permission.READ_MESSAGES | Permission.CONNECT
    );
  });
});

describe('removePermission', () => {
  it('removes an existing flag from the permission set', () => {
    const perms = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
    const updated = removePermission(perms, Permission.SEND_MESSAGES);
    expect(updated & Permission.SEND_MESSAGES).toBe(0n);
    expect(updated & Permission.READ_MESSAGES).toBe(Permission.READ_MESSAGES);
  });

  it('is idempotent -- removing an absent flag does not change the value', () => {
    const perms = Permission.SEND_MESSAGES;
    const updated = removePermission(perms, Permission.READ_MESSAGES);
    expect(updated).toBe(perms);
  });

  it('does not affect other flags when removing one', () => {
    const perms =
      Permission.SEND_MESSAGES |
      Permission.READ_MESSAGES |
      Permission.CONNECT |
      Permission.SPEAK;
    const updated = removePermission(perms, Permission.CONNECT);
    expect(updated).toBe(
      Permission.SEND_MESSAGES | Permission.READ_MESSAGES | Permission.SPEAK
    );
  });
});

describe('computeChannelPermissions', () => {
  it('returns ALL_PERMISSIONS for ADMINISTRATOR base permissions', () => {
    const base = Permission.ADMINISTRATOR | Permission.READ_MESSAGES;
    const result = computeChannelPermissions(base, [
      { allow: 0n, deny: Permission.READ_MESSAGES },
    ]);
    expect(result).toBe(ALL_PERMISSIONS);
  });

  it('returns base permissions unchanged when overrides array is empty', () => {
    const base = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
    const result = computeChannelPermissions(base, []);
    expect(result).toBe(base);
  });

  it('a single deny override removes a permission', () => {
    const base = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
    const result = computeChannelPermissions(base, [
      { allow: 0n, deny: Permission.SEND_MESSAGES },
    ]);
    expect(result & Permission.SEND_MESSAGES).toBe(0n);
    expect(result & Permission.READ_MESSAGES).toBe(Permission.READ_MESSAGES);
  });

  it('a single allow override adds a permission', () => {
    const base = Permission.READ_MESSAGES;
    const result = computeChannelPermissions(base, [
      { allow: Permission.SEND_MESSAGES, deny: 0n },
    ]);
    expect(result & Permission.SEND_MESSAGES).toBe(Permission.SEND_MESSAGES);
    expect(result & Permission.READ_MESSAGES).toBe(Permission.READ_MESSAGES);
  });

  it('within a single override, deny is applied first then allow', () => {
    const base = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
    // Deny and allow the same flag in one override: allow wins because
    // the implementation applies deny (&= ~deny) then allow (|= allow).
    const result = computeChannelPermissions(base, [
      { allow: Permission.SEND_MESSAGES, deny: Permission.SEND_MESSAGES },
    ]);
    expect(result & Permission.SEND_MESSAGES).toBe(Permission.SEND_MESSAGES);
  });

  it('multiple overrides stack in order', () => {
    const base =
      Permission.SEND_MESSAGES |
      Permission.READ_MESSAGES |
      Permission.CONNECT;

    const result = computeChannelPermissions(base, [
      // First override: remove CONNECT
      { allow: 0n, deny: Permission.CONNECT },
      // Second override: add SPEAK
      { allow: Permission.SPEAK, deny: 0n },
    ]);

    expect(result & Permission.CONNECT).toBe(0n);
    expect(result & Permission.SPEAK).toBe(Permission.SPEAK);
    expect(result & Permission.SEND_MESSAGES).toBe(Permission.SEND_MESSAGES);
    expect(result & Permission.READ_MESSAGES).toBe(Permission.READ_MESSAGES);
  });

  it('a permission denied in a first override can be re-allowed in a second override', () => {
    const base = Permission.SEND_MESSAGES | Permission.READ_MESSAGES;
    const result = computeChannelPermissions(base, [
      { allow: 0n, deny: Permission.SEND_MESSAGES },
      { allow: Permission.SEND_MESSAGES, deny: 0n },
    ]);
    expect(result & Permission.SEND_MESSAGES).toBe(Permission.SEND_MESSAGES);
    expect(result & Permission.READ_MESSAGES).toBe(Permission.READ_MESSAGES);
  });
});

describe('permissionToString / stringToPermission', () => {
  it('round-trips: stringToPermission(permissionToString(x)) === x', () => {
    for (const flag of Object.values(Permission)) {
      expect(stringToPermission(permissionToString(flag))).toBe(flag);
    }
    expect(stringToPermission(permissionToString(ALL_PERMISSIONS))).toBe(
      ALL_PERMISSIONS
    );
    expect(stringToPermission(permissionToString(DEFAULT_PERMISSIONS))).toBe(
      DEFAULT_PERMISSIONS
    );
    expect(stringToPermission(permissionToString(0n))).toBe(0n);
  });

  it('handles large bigint values', () => {
    const large = 1n << 64n;
    expect(stringToPermission(permissionToString(large))).toBe(large);
  });

  it('permissionToString returns a decimal string representation', () => {
    expect(permissionToString(0n)).toBe('0');
    expect(permissionToString(1n)).toBe('1');
    expect(permissionToString(Permission.MENTION_EVERYONE)).toBe('8192');
    expect(permissionToString(ALL_PERMISSIONS)).toBe(
      (Object.values(Permission).reduce((acc, p) => acc | p, 0n)).toString()
    );
  });
});
