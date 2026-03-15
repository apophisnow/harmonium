import { useState, useEffect } from 'react';
import { useToastStore } from '../../../stores/toast.store.js';
import { getPrivacySettings, updatePrivacySettings } from '../../../api/users.js';
import type { PrivacySettings } from '@harmonium/shared';

export function PrivacyTab() {
  const addToast = useToastStore((s) => s.addToast);
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPrivacySettings()
      .then(setSettings)
      .catch(() => addToast('error', 'Failed to load privacy settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key: keyof PrivacySettings) => {
    if (!settings) return;
    const newValue = !settings[key];
    const prev = { ...settings };
    setSettings({ ...settings, [key]: newValue });

    try {
      const updated = await updatePrivacySettings({ [key]: newValue });
      setSettings(updated);
    } catch {
      setSettings(prev);
      addToast('error', 'Failed to update privacy settings');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-th-brand border-t-transparent" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-th-text-primary">Privacy & Safety</h2>

      {/* Social Permissions */}
      <section>
        <h3 className="mb-4 text-base font-semibold text-th-text-primary">
          Social Permissions
        </h3>
        <ToggleRow
          label="Direct Messages from Server Members"
          description="Allow DMs from other server members who aren't your friends"
          checked={settings.allowDmsFromServerMembers}
          onChange={() => handleToggle('allowDmsFromServerMembers')}
        />
      </section>

      <div className="border-t border-th-border" />

      {/* Friend Requests */}
      <section>
        <h3 className="mb-4 text-base font-semibold text-th-text-primary">
          Friend Requests
        </h3>
        <p className="mb-4 text-sm text-th-text-secondary">
          Who can send you a friend request
        </p>
        <div className="space-y-2">
          <ToggleRow
            label="Everyone"
            description="Anyone on Harmonium can send you a friend request"
            checked={settings.friendRequestFromEveryone}
            onChange={() => handleToggle('friendRequestFromEveryone')}
          />
          <ToggleRow
            label="Friend of friends"
            description="Friends of your existing friends can send you requests"
            checked={settings.friendRequestFromFof}
            onChange={() => handleToggle('friendRequestFromFof')}
          />
          <ToggleRow
            label="Server members"
            description="People who share a server with you can send you requests"
            checked={settings.friendRequestFromServerMembers}
            onChange={() => handleToggle('friendRequestFromServerMembers')}
          />
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md py-3">
      <div className="min-w-0 flex-1 pr-4">
        <div className="text-sm font-medium text-th-text-primary">{label}</div>
        <div className="text-sm text-th-text-secondary">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
          checked ? 'bg-th-brand' : 'bg-th-bg-tertiary'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          } mt-0.5`}
        />
      </button>
    </div>
  );
}
