import { create } from 'zustand';
import type { Server } from '@harmonium/shared';
import { getServers } from '../api/servers.js';

interface ServerState {
  servers: Map<string, Server>;
  currentServerId: string | null;

  fetchServers: () => Promise<void>;
  setCurrentServer: (id: string | null) => void;
  addServer: (server: Server) => void;
  removeServer: (id: string) => void;
  updateServer: (server: Server) => void;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: new Map(),
  currentServerId: null,

  fetchServers: async () => {
    const serverList = await getServers();
    const servers = new Map<string, Server>();
    for (const server of serverList) {
      servers.set(server.id, server);
    }
    set({ servers });
  },

  setCurrentServer: (id) => {
    set({ currentServerId: id });
  },

  addServer: (server) => {
    const servers = new Map(get().servers);
    servers.set(server.id, server);
    set({ servers });
  },

  removeServer: (id) => {
    const servers = new Map(get().servers);
    servers.delete(id);
    const currentServerId =
      get().currentServerId === id ? null : get().currentServerId;
    set({ servers, currentServerId });
  },

  updateServer: (server) => {
    const servers = new Map(get().servers);
    servers.set(server.id, server);
    set({ servers });
  },
}));
