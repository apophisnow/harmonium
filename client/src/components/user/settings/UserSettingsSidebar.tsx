export type UserSettingsTab = 'account' | 'appearance';

const NAV_ITEMS: Array<{ id: UserSettingsTab; label: string }> = [
  { id: 'account', label: 'My Account' },
  { id: 'appearance', label: 'Appearance' },
];

interface UserSettingsSidebarProps {
  activeTab: UserSettingsTab;
  onTabChange: (tab: UserSettingsTab) => void;
}

export function UserSettingsSidebar({
  activeTab,
  onTabChange,
}: UserSettingsSidebarProps) {
  return (
    <nav className="flex flex-col gap-0.5">
      <h3 className="mb-1 px-2.5 text-xs font-bold uppercase text-th-text-secondary">
        User Settings
      </h3>
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => onTabChange(item.id)}
          className={`rounded px-2.5 py-1.5 text-left text-sm font-medium transition-colors ${
            activeTab === item.id
              ? 'bg-th-bg-accent text-white'
              : 'text-th-text-secondary hover:bg-th-bg-primary hover:text-th-text-primary'
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
