import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscoveryServer } from '@harmonium/shared';
import { SERVER_CATEGORIES } from '@harmonium/shared';
import { getDiscoverableServers, joinDiscoveryServer } from '../api/discovery.js';
import { useServerStore } from '../stores/server.store.js';
import { LoadingSpinner } from '../components/shared/LoadingSpinner.js';
import { getInitials } from '../lib/formatters.js';

type SortOption = 'member_count' | 'newest';

export function DiscoveryPage() {
  const navigate = useNavigate();
  const servers = useServerStore((s) => s.servers);
  const fetchServers = useServerStore((s) => s.fetchServers);

  const [results, setResults] = useState<DiscoveryServer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(24);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<SortOption>('member_count');
  const [isLoading, setIsLoading] = useState(true);
  const [joiningServerId, setJoiningServerId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadServers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getDiscoverableServers({
        search: search || undefined,
        category,
        sort,
        page,
        limit,
      });
      setResults(data.servers);
      setTotal(data.total);
    } catch {
      setError('Failed to load servers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [search, category, sort, page, limit]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleCategoryClick = (cat: string | undefined) => {
    setPage(1);
    setCategory(cat);
  };

  const handleJoin = async (serverId: string) => {
    setJoiningServerId(serverId);
    try {
      await joinDiscoveryServer(serverId);
      await fetchServers();
      navigate(`/channels/${serverId}`);
    } catch {
      // Error toast handled by API client interceptor
    } finally {
      setJoiningServerId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex min-h-screen flex-col bg-th-bg-tertiary">
      {/* Header */}
      <div className="border-b border-th-border bg-th-bg-secondary">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-1 flex items-center gap-3">
            <button
              onClick={() => navigate('/channels/@me')}
              className="rounded p-1.5 text-th-text-secondary transition-colors hover:bg-th-bg-primary hover:text-th-text-primary"
              aria-label="Back"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-th-text-primary">
              Discover Servers
            </h1>
          </div>
          <p className="mb-6 text-th-text-secondary">
            Find communities to join on Harmonium
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-th-text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search for servers..."
                className="w-full rounded-md border border-th-border bg-th-bg-primary py-2 pl-10 pr-4 text-sm text-th-text-primary placeholder-th-text-muted outline-none focus:border-th-brand"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-th-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-6 py-6">
        {/* Sidebar filters */}
        <div className="w-48 flex-shrink-0">
          <h3 className="mb-2 text-xs font-bold uppercase text-th-text-secondary">
            Categories
          </h3>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => handleCategoryClick(undefined)}
              className={`rounded px-2.5 py-1.5 text-left text-sm font-medium transition-colors ${
                category === undefined
                  ? 'bg-th-bg-accent text-white'
                  : 'text-th-text-secondary hover:bg-th-bg-primary hover:text-th-text-primary'
              }`}
            >
              All
            </button>
            {SERVER_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`rounded px-2.5 py-1.5 text-left text-sm font-medium transition-colors ${
                  category === cat
                    ? 'bg-th-bg-accent text-white'
                    : 'text-th-text-secondary hover:bg-th-bg-primary hover:text-th-text-primary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="my-4 border-t border-th-border" />

          <h3 className="mb-2 text-xs font-bold uppercase text-th-text-secondary">
            Sort By
          </h3>
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => { setSort('member_count'); setPage(1); }}
              className={`rounded px-2.5 py-1.5 text-left text-sm font-medium transition-colors ${
                sort === 'member_count'
                  ? 'bg-th-bg-accent text-white'
                  : 'text-th-text-secondary hover:bg-th-bg-primary hover:text-th-text-primary'
              }`}
            >
              Most Members
            </button>
            <button
              onClick={() => { setSort('newest'); setPage(1); }}
              className={`rounded px-2.5 py-1.5 text-left text-sm font-medium transition-colors ${
                sort === 'newest'
                  ? 'bg-th-bg-accent text-white'
                  : 'text-th-text-secondary hover:bg-th-bg-primary hover:text-th-text-primary'
              }`}
            >
              Newest
            </button>
          </div>
        </div>

        {/* Server grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner size={40} className="text-th-brand" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="mb-4 text-th-text-secondary">{error}</p>
              <button
                onClick={loadServers}
                className="rounded-md bg-th-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover"
              >
                Retry
              </button>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <svg
                className="mb-4 h-16 w-16 text-th-text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <h3 className="mb-1 text-lg font-semibold text-th-text-primary">
                No servers found
              </h3>
              <p className="text-sm text-th-text-secondary">
                {search
                  ? `No results for "${search}". Try a different search.`
                  : 'No discoverable servers available yet.'}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 text-sm text-th-text-secondary">
                {total} server{total !== 1 ? 's' : ''} found
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((server) => {
                  const isMember = servers.has(server.id);
                  const isJoining = joiningServerId === server.id;

                  return (
                    <div
                      key={server.id}
                      className="flex flex-col overflow-hidden rounded-lg border border-th-border bg-th-bg-secondary transition-shadow hover:shadow-lg"
                    >
                      {/* Banner */}
                      <div className="relative h-28">
                        {server.bannerUrl ? (
                          <img
                            src={server.bannerUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="h-full w-full"
                            style={{
                              background: `linear-gradient(135deg, hsl(${hashCode(server.id) % 360}, 60%, 40%), hsl(${(hashCode(server.id) + 60) % 360}, 60%, 30%))`,
                            }}
                          />
                        )}
                        {/* Server icon overlapping banner */}
                        <div className="absolute -bottom-6 left-4 flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-th-bg-secondary bg-th-bg-primary">
                          {server.iconUrl ? (
                            <img
                              src={server.iconUrl}
                              alt={server.name}
                              className="h-full w-full rounded-xl object-cover"
                            />
                          ) : (
                            <span className="text-sm font-bold text-th-text-primary">
                              {getInitials(server.name)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex flex-1 flex-col p-4 pt-8">
                        <h3 className="mb-0.5 truncate text-base font-semibold text-th-text-primary">
                          {server.name}
                        </h3>

                        {server.description ? (
                          <p className="mb-3 line-clamp-2 text-xs text-th-text-secondary">
                            {server.description}
                          </p>
                        ) : (
                          <div className="mb-3" />
                        )}

                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {server.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {server.categories.slice(0, 3).map((cat) => (
                                  <span key={cat} className="rounded bg-th-bg-primary px-2 py-0.5 text-[11px] font-medium text-th-text-secondary">
                                    {cat}
                                  </span>
                                ))}
                                {server.categories.length > 3 && (
                                  <span className="rounded bg-th-bg-primary px-2 py-0.5 text-[11px] font-medium text-th-text-muted">
                                    +{server.categories.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                            <span className="flex items-center gap-1 text-xs text-th-text-muted">
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                              </svg>
                              {formatMemberCount(server.memberCount)}
                            </span>
                          </div>

                          {isMember ? (
                            <button
                              onClick={() => navigate(`/channels/${server.id}`)}
                              className="rounded-md bg-th-bg-primary px-3 py-1.5 text-xs font-medium text-th-text-primary transition-colors hover:bg-th-bg-accent"
                            >
                              Joined
                            </button>
                          ) : (
                            <button
                              onClick={() => handleJoin(server.id)}
                              disabled={isJoining}
                              className="flex items-center gap-1.5 rounded-md bg-th-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-th-brand-hover disabled:opacity-50"
                            >
                              {isJoining && <LoadingSpinner size={12} />}
                              Join
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-md bg-th-bg-secondary px-3 py-1.5 text-sm text-th-text-secondary transition-colors hover:bg-th-bg-primary disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-th-text-secondary">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-md bg-th-bg-secondary px-3 py-1.5 text-sm text-th-text-secondary transition-colors hover:bg-th-bg-primary disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function formatMemberCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}
