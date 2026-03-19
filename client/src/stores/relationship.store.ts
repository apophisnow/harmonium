import { create } from 'zustand';
import type { Relationship } from '@harmonium/shared';
import * as relationshipsApi from '../api/relationships.js';

interface RelationshipState {
  relationships: Map<string, Relationship>;

  fetchRelationships: () => Promise<void>;
  sendFriendRequest: (username: string, discriminator: string) => Promise<void>;
  acceptFriendRequest: (userId: string) => Promise<void>;
  declineFriendRequest: (userId: string) => Promise<void>;
  removeFriend: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  ignoreUser: (userId: string) => Promise<void>;
  unignoreUser: (userId: string) => Promise<void>;

  updateRelationship: (relationship: Relationship) => void;
  removeRelationship: (userId: string) => void;

  isFriend: (userId: string) => boolean;
  isBlocked: (userId: string) => boolean;
  isIgnored: (userId: string) => boolean;
}

export const useRelationshipStore = create<RelationshipState>((set, get) => ({
  relationships: new Map(),

  fetchRelationships: async () => {
    const list = await relationshipsApi.getRelationships();
    const relationships = new Map<string, Relationship>();
    for (const rel of list) {
      relationships.set(rel.user.id, rel);
    }
    set({ relationships });
  },

  sendFriendRequest: async (username, discriminator) => {
    await relationshipsApi.sendFriendRequest(username, discriminator);
  },

  acceptFriendRequest: async (userId) => {
    await relationshipsApi.acceptFriendRequest(userId);
  },

  declineFriendRequest: async (userId) => {
    await relationshipsApi.declineFriendRequest(userId);
  },

  removeFriend: async (userId) => {
    await relationshipsApi.removeFriend(userId);
  },

  blockUser: async (userId) => {
    await relationshipsApi.blockUser(userId);
  },

  unblockUser: async (userId) => {
    await relationshipsApi.unblockUser(userId);
  },

  ignoreUser: async (userId) => {
    await relationshipsApi.ignoreUser(userId);
  },

  unignoreUser: async (userId) => {
    await relationshipsApi.unignoreUser(userId);
  },

  updateRelationship: (relationship) => {
    const relationships = new Map(get().relationships);
    relationships.set(relationship.user.id, relationship);
    set({ relationships });
  },

  removeRelationship: (userId) => {
    const relationships = new Map(get().relationships);
    relationships.delete(userId);
    set({ relationships });
  },

  isFriend: (userId) => {
    const rel = get().relationships.get(userId);
    return rel?.type === 'friend';
  },

  isBlocked: (userId) => {
    const rel = get().relationships.get(userId);
    return rel?.type === 'blocked';
  },

  isIgnored: (userId) => {
    const rel = get().relationships.get(userId);
    return rel?.type === 'ignored';
  },
}));
