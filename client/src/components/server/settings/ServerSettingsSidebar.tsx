export type SettingsTab = 'overview' | 'roles' | 'members' | 'invites' | 'delete';

interface ServerSettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  serverName: string;
  isOwner: boolean;
}

const NAV_ITEMS: Array<{ id: SettingsTab; label: string; danger?: boolean; ownerOnly?: boolean }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'roles', label: 'Roles' },
  { id: 'members', label: 'Members' },
  { id: 'invites', label: 'Invites' },
  { id: 'delete', label: 'Delete Server', danger: true, ownerOnly: true },
];

export function ServerSettingsSidebar({
  activeTab,
  onTabChange,
  serverName,
  isOwner,
}: ServerSettingsSidebarProps) {
  const mainItems = NAV_ITEMS.filter((item) => !item.danger);
  const dangerItems = NAV_ITEMS.filter((item) => item.danger && (!item.ownerOnly || isOwner));

  return (
    <nav className="flex flex-col gap-0.5">
      <h3 className="mb-1 truncate px-2.5 text-xs font-bold uppercase text-th-text-secondary">
        {serverName}
      </h3>
      {mainItems.map((item) => (
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
      {dangerItems.length > 0 && (
        <>
          <div className="my-1 border-t border-th-border" />
          {dangerItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`rounded px-2.5 py-1.5 text-left text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-th-red/20 text-th-red'
                  : 'text-th-red hover:bg-th-red/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </>
      )}
    </nav>
  );
}
