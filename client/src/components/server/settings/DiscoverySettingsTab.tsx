import { useState, useEffect } from 'react';
import { SERVER_CATEGORIES } from '@harmonium/shared';
import type { DiscoverySettings } from '@harmonium/shared';
import { getDiscoverySettings, updateDiscoverySettings } from '../../../api/discovery.js';
import { LoadingSpinner } from '../../shared/LoadingSpinner.js';

interface DiscoverySettingsTabProps {
  serverId: string;
}

export function DiscoverySettingsTab({ serverId }: DiscoverySettingsTabProps) {
  const [settings, setSettings] = useState<DiscoverySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form state
  const [isDiscoverable, setIsDiscoverable] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [vanityUrl, setVanityUrl] = useState('');
  const [primaryLanguage, setPrimaryLanguage] = useState('en');

  useEffect(() => {
    setIsLoading(true);
    getDiscoverySettings(serverId)
      .then((s) => {
        setSettings(s);
        setIsDiscoverable(s.isDiscoverable);
        setDescription(s.description ?? '');
        setCategory(s.category ?? '');
        setVanityUrl(s.vanityUrl ?? '');
        setPrimaryLanguage(s.primaryLanguage);
      })
      .catch(() => setError('Failed to load discovery settings'))
      .finally(() => setIsLoading(false));
  }, [serverId]);

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const updated = await updateDiscoverySettings(serverId, {
        isDiscoverable,
        description: description || null,
        category: category || null,
        vanityUrl: vanityUrl || null,
        primaryLanguage,
      });
      setSettings(updated);
      setSuccessMessage('Discovery settings saved.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch {
      setError('Failed to save discovery settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    settings !== null &&
    (isDiscoverable !== settings.isDiscoverable ||
      (description || null) !== (settings.description ?? null) ||
      (category || null) !== (settings.category ?? null) ||
      (vanityUrl || null) !== (settings.vanityUrl ?? null) ||
      primaryLanguage !== settings.primaryLanguage);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size={32} className="text-th-brand" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-th-text-primary">Discovery</h2>
      <p className="mb-6 text-sm text-th-text-secondary">
        Make your server discoverable so others can find and join it.
      </p>

      {error && (
        <div className="mb-4 rounded bg-th-red/10 px-4 py-2 text-sm text-th-red">{error}</div>
      )}
      {successMessage && (
        <div className="mb-4 rounded bg-th-green/10 px-4 py-2 text-sm text-th-green">
          {successMessage}
        </div>
      )}

      {/* Discoverable toggle */}
      <div className="mb-6 flex items-center justify-between rounded-md bg-th-bg-secondary p-4">
        <div>
          <h3 className="text-sm font-semibold text-th-text-primary">
            Enable Server Discovery
          </h3>
          <p className="text-xs text-th-text-secondary">
            Allow your server to appear in the public server directory.
          </p>
        </div>
        <button
          onClick={() => setIsDiscoverable(!isDiscoverable)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isDiscoverable ? 'bg-th-brand' : 'bg-th-bg-primary'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              isDiscoverable ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-bold uppercase text-th-text-secondary">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Tell people what your server is about..."
          className="w-full resize-none rounded-md border border-th-border bg-th-bg-primary px-3 py-2 text-sm text-th-text-primary placeholder-th-text-muted outline-none focus:border-th-brand"
        />
        <span className="text-xs text-th-text-muted">{description.length}/1000</span>
      </div>

      {/* Category */}
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-bold uppercase text-th-text-secondary">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-md border border-th-border bg-th-bg-primary px-3 py-2 text-sm text-th-text-primary outline-none focus:border-th-brand"
        >
          <option value="">None</option>
          {SERVER_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Vanity URL */}
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-bold uppercase text-th-text-secondary">
          Vanity URL
        </label>
        <input
          type="text"
          value={vanityUrl}
          onChange={(e) => setVanityUrl(e.target.value)}
          maxLength={32}
          placeholder="my-server"
          className="w-full rounded-md border border-th-border bg-th-bg-primary px-3 py-2 text-sm text-th-text-primary placeholder-th-text-muted outline-none focus:border-th-brand"
        />
        <span className="text-xs text-th-text-muted">
          Letters, numbers, and hyphens only.
        </span>
      </div>

      {/* Primary Language */}
      <div className="mb-6">
        <label className="mb-1.5 block text-xs font-bold uppercase text-th-text-secondary">
          Primary Language
        </label>
        <select
          value={primaryLanguage}
          onChange={(e) => setPrimaryLanguage(e.target.value)}
          className="w-full rounded-md border border-th-border bg-th-bg-primary px-3 py-2 text-sm text-th-text-primary outline-none focus:border-th-brand"
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="zh">Chinese</option>
          <option value="pt">Portuguese</option>
          <option value="ru">Russian</option>
          <option value="ar">Arabic</option>
        </select>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={isSaving || !hasChanges}
        className="flex items-center gap-2 rounded-md bg-th-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover disabled:opacity-50"
      >
        {isSaving && <LoadingSpinner size={14} />}
        Save Changes
      </button>
    </div>
  );
}
