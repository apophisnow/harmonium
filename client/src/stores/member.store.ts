import { create } from 'zustand';
import type { PublicUser, ServerMember } from '@harmonium/shared';
import { getMembers } from '../api/servers.js';

interface MemberState {
  members: Map<string, ServerMember[]>;

  fetchMembers: (serverId: string) => Promise<void>;
  addMember: (serverId: string, member: ServerMember) => void;
  removeMember: (serverId: string, userId: string) => void;
  updateMemberUser: (user: PublicUser) => void;
  updateMemberRoles: (serverId: string, userId: string, roles: string[]) => void;
}

export const useMemberStore = create<MemberState>((set, get) => ({
  members: new Map(),

  fetchMembers: async (serverId) => {
    const memberList = await getMembers(serverId);
    const members = new Map(get().members);
    members.set(serverId, memberList);
    set({ members });
  },

  addMember: (serverId, member) => {
    const members = new Map(get().members);
    const list = members.get(serverId) ?? [];
    // Prevent duplicates
    if (list.some((m) => m.userId === member.userId)) return;
    members.set(serverId, [...list, member]);
    set({ members });
  },

  removeMember: (serverId, userId) => {
    const members = new Map(get().members);
    const list = members.get(serverId) ?? [];
    members.set(
      serverId,
      list.filter((m) => m.userId !== userId),
    );
    set({ members });
  },

  updateMemberUser: (user) => {
    const members = new Map(get().members);
    let changed = false;
    for (const [serverId, list] of members) {
      const updated = list.map((m) => {
        if (m.userId === user.id && m.user) {
          changed = true;
          return { ...m, user };
        }
        return m;
      });
      if (changed) {
        members.set(serverId, updated);
      }
    }
    if (changed) {
      set({ members });
    }
  },

  updateMemberRoles: (serverId, userId, roles) => {
    const members = new Map(get().members);
    const list = members.get(serverId) ?? [];
    members.set(
      serverId,
      list.map((m) => (m.userId === userId ? { ...m, roles } : m)),
    );
    set({ members });
  },
}));
