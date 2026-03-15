import { create } from 'zustand';
import type { SearchResult, SearchFilters } from '@harmonium/shared';
import { searchMessages } from '../api/search.js';

interface SearchState {
  results: SearchResult[];
  totalCount: number;
  isSearching: boolean;
  query: string;
  filters: Partial<SearchFilters>;
  isOpen: boolean;

  search: (filters: SearchFilters) => Promise<void>;
  clearSearch: () => void;
  loadMore: () => Promise<void>;
  setOpen: (open: boolean) => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  results: [],
  totalCount: 0,
  isSearching: false,
  query: '',
  filters: {},
  isOpen: false,

  search: async (filters) => {
    set({ isSearching: true, query: filters.query, filters });

    try {
      const response = await searchMessages(filters);
      set({
        results: response.results,
        totalCount: response.totalCount,
        isSearching: false,
      });
    } catch {
      set({ isSearching: false });
    }
  },

  clearSearch: () => {
    set({
      results: [],
      totalCount: 0,
      query: '',
      filters: {},
      isSearching: false,
    });
  },

  loadMore: async () => {
    const state = get();
    if (state.isSearching || state.results.length >= state.totalCount) return;

    const filters: SearchFilters = {
      ...state.filters,
      query: state.query,
      offset: state.results.length,
    };

    set({ isSearching: true });

    try {
      const response = await searchMessages(filters);
      set({
        results: [...state.results, ...response.results],
        totalCount: response.totalCount,
        isSearching: false,
      });
    } catch {
      set({ isSearching: false });
    }
  },

  setOpen: (open) => {
    set({ isOpen: open });
    if (!open) {
      get().clearSearch();
    }
  },
}));
