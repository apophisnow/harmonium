import { useState, useEffect, useCallback, useRef } from 'react';
import type { SearchResult, SearchFilters } from '@harmonium/shared';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog.js';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useSearchStore } from '../../stores/search.store.js';
import { useServerStore } from '../../stores/server.store.js';
import { useNavigate } from 'react-router-dom';

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays === 1) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function highlightTerms(text: string, query: string): React.ReactNode[] {
  if (!query.trim()) return [text];

  const terms = query
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (terms.length === 0) return [text];

  const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    if (pattern.test(part)) {
      return (
        <mark key={i} className="bg-th-brand/30 text-th-text-primary rounded-sm px-0.5">
          {part}
        </mark>
      );
    }
    pattern.lastIndex = 0;
    return part;
  });
}

function SearchResultItem({
  result,
  query,
  onClick,
}: {
  result: SearchResult;
  query: string;
  onClick: () => void;
}) {
  const { message, channelName, serverName } = result;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-md p-3 text-left transition-colors hover:bg-th-bg-accent"
    >
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span className="font-semibold text-th-text-primary">
          {message.author?.username ?? 'Unknown'}
        </span>
        <span className="text-th-text-muted">in</span>
        <span className="text-th-text-secondary">#{channelName}</span>
        <span className="text-th-text-muted">-</span>
        <span className="text-th-text-muted">{serverName}</span>
        <span className="ml-auto text-th-text-muted">
          {formatTimestamp(message.createdAt)}
        </span>
      </div>

      <div className="text-sm text-th-text-secondary line-clamp-2">
        {message.content ? highlightTerms(message.content, query) : (
          <span className="italic text-th-text-muted">No content</span>
        )}
      </div>
    </button>
  );
}

function SkeletonResult() {
  return (
    <div className="animate-pulse rounded-md p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="h-3 w-20 rounded bg-th-bg-accent" />
        <div className="h-3 w-16 rounded bg-th-bg-accent" />
        <div className="ml-auto h-3 w-24 rounded bg-th-bg-accent" />
      </div>
      <div className="h-4 w-3/4 rounded bg-th-bg-accent" />
    </div>
  );
}

export function SearchModal() {
  const navigate = useNavigate();

  const isOpen = useSearchStore((s) => s.isOpen);
  const setOpen = useSearchStore((s) => s.setOpen);
  const results = useSearchStore((s) => s.results);
  const totalCount = useSearchStore((s) => s.totalCount);
  const isSearching = useSearchStore((s) => s.isSearching);
  const query = useSearchStore((s) => s.query);
  const searchFn = useSearchStore((s) => s.search);
  const loadMore = useSearchStore((s) => s.loadMore);
  const clearSearch = useSearchStore((s) => s.clearSearch);

  const currentServerId = useServerStore((s) => s.currentServerId);

  const [inputValue, setInputValue] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setInputValue('');
      setChannelFilter('');
      setAuthorFilter('');
    }
  }, [isOpen]);

  // Keyboard shortcut: Cmd/Ctrl+F
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !isInput) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setOpen]);

  // Debounced search
  const performSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (!value.trim()) {
        clearSearch();
        return;
      }

      debounceRef.current = setTimeout(() => {
        const filters: SearchFilters = {
          query: value.trim(),
          limit: 25,
          offset: 0,
        };

        if (currentServerId) {
          filters.serverId = currentServerId;
        }
        if (channelFilter) {
          filters.channelId = channelFilter;
        }
        if (authorFilter) {
          filters.authorId = authorFilter;
        }

        searchFn(filters);
      }, 300);
    },
    [currentServerId, channelFilter, authorFilter, searchFn, clearSearch],
  );

  const handleInputChange = (value: string) => {
    setInputValue(value);
    performSearch(value);
  };

  const handleResultClick = (result: SearchResult) => {
    const channelId = result.message.channelId;

    if (currentServerId) {
      navigate(`/channels/${currentServerId}/${channelId}`);
    }

    setOpen(false);
  };

  const handleClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="top-[20%] translate-y-0 max-w-2xl flex flex-col max-h-[70vh] gap-0 p-0">
        <VisuallyHidden>
          <DialogTitle>Search Messages</DialogTitle>
        </VisuallyHidden>

        {/* Search Input */}
        <div className="flex items-center border-b border-th-border p-4">
          <svg
            className="mr-3 h-5 w-5 flex-shrink-0 text-th-text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-th-text-primary placeholder-th-text-muted outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 border-b border-th-border px-4 py-2">
          <input
            type="text"
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value);
              if (inputValue.trim()) performSearch(inputValue);
            }}
            placeholder="Channel ID"
            className="w-32 rounded bg-th-bg-primary px-2 py-1 text-xs text-th-text-primary placeholder-th-text-muted outline-none border border-th-border"
          />
          <input
            type="text"
            value={authorFilter}
            onChange={(e) => {
              setAuthorFilter(e.target.value);
              if (inputValue.trim()) performSearch(inputValue);
            }}
            placeholder="Author ID"
            className="w-32 rounded bg-th-bg-primary px-2 py-1 text-xs text-th-text-primary placeholder-th-text-muted outline-none border border-th-border"
          />
          {currentServerId && (
            <span className="ml-auto text-xs text-th-text-muted">
              Searching current server
            </span>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {isSearching && results.length === 0 && (
            <div className="space-y-1">
              <SkeletonResult />
              <SkeletonResult />
              <SkeletonResult />
            </div>
          )}

          {!isSearching && !query && (
            <div className="flex flex-col items-center justify-center py-12 text-th-text-muted">
              <svg
                className="mb-3 h-10 w-10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <p className="text-sm">Type to search messages</p>
              <p className="mt-1 text-xs">Use Ctrl+F or Cmd+F to open search</p>
            </div>
          )}

          {!isSearching && query && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-th-text-muted">
              <p className="text-sm">No results found</p>
              <p className="mt-1 text-xs">Try different search terms</p>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="mb-2 px-3 text-xs text-th-text-muted">
                {totalCount} result{totalCount !== 1 ? 's' : ''}
              </div>
              <div className="space-y-0.5">
                {results.map((result) => (
                  <SearchResultItem
                    key={result.message.id}
                    result={result}
                    query={query}
                    onClick={() => handleResultClick(result)}
                  />
                ))}
              </div>

              {results.length < totalCount && (
                <div className="flex justify-center py-3">
                  <button
                    onClick={loadMore}
                    disabled={isSearching}
                    className="rounded bg-th-bg-accent px-4 py-1.5 text-xs text-th-text-secondary hover:text-th-text-primary transition-colors disabled:opacity-50"
                  >
                    {isSearching ? 'Loading...' : 'Load more'}
                  </button>
                </div>
              )}

              {isSearching && results.length > 0 && (
                <div className="flex justify-center py-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-th-text-muted border-t-transparent" />
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
