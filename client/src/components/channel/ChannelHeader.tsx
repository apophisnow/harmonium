import type { Channel } from '@harmonium/shared';
import { useUIStore } from '../../stores/ui.store.js';
import { useIsMobile } from '../../hooks/useMediaQuery.js';

interface ChannelHeaderProps {
  channel: Channel | null;
}

export function ChannelHeader({ channel }: ChannelHeaderProps) {
  const toggleMemberSidebar = useUIStore((s) => s.toggleMemberSidebar);
  const toggleMobileSidebar = useUIStore((s) => s.toggleMobileSidebar);
  const showMemberSidebar = useUIStore((s) => s.showMemberSidebar);
  const isMobile = useIsMobile();

  if (!channel) {
    return (
      <div className="flex h-12 items-center border-b border-[#202225] bg-[#36393f] px-4 shadow-sm">
        {/* Hamburger menu - mobile only */}
        {isMobile && (
          <button
            onClick={toggleMobileSidebar}
            className="mr-3 rounded p-1.5 text-[#96989d] hover:text-[#dcddde] transition-colors md:hidden"
            title="Toggle Sidebar"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
        )}
        <span className="text-sm text-[#96989d]">Select a channel</span>
      </div>
    );
  }

  return (
    <div className="flex h-12 items-center border-b border-[#202225] bg-[#36393f] px-4 shadow-sm">
      {/* Hamburger menu - mobile only */}
      {isMobile && (
        <button
          onClick={toggleMobileSidebar}
          className="mr-3 rounded p-1.5 text-[#96989d] hover:text-[#dcddde] transition-colors md:hidden"
          title="Toggle Sidebar"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
      )}

      {/* Channel name */}
      <div className="flex items-center gap-2">
        {channel.type === 'text' ? (
          <span className="text-xl text-[#96989d]">#</span>
        ) : (
          <svg
            className="h-5 w-5 text-[#96989d]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 3a1 1 0 0 0-1 1v8a3 3 0 0 0 6 0V4a1 1 0 1 0-2 0v8a1 1 0 1 1-2 0V4a1 1 0 0 0-1-1zM7 12a5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21a1 1 0 1 1-2 0v-2.07A7 7 0 0 1 5 12a1 1 0 1 1 2 0z" />
          </svg>
        )}
        <h2 className="font-semibold text-white">{channel.name}</h2>
      </div>

      {/* Topic divider */}
      {channel.topic && (
        <>
          <div className="mx-3 h-6 w-px bg-[#40444b]" />
          <p className="truncate text-sm text-[#96989d]">{channel.topic}</p>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Member list toggle (hidden on mobile) */}
      <button
        onClick={toggleMemberSidebar}
        className={`hidden rounded p-1.5 transition-colors md:block ${
          showMemberSidebar
            ? 'text-white bg-[#40444b]'
            : 'text-[#96989d] hover:text-[#dcddde]'
        }`}
        title="Toggle Member List"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.795 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006ZM20 20.006H22V19.006C22 16.165 20.047 14.162 17.2 13.358C18.894 14.342 20 16.37 20 19.006V20.006Z" />
          <path d="M14 8.00598C14 10.211 15.794 12.006 18 12.006C20.206 12.006 22 10.211 22 8.00598C22 5.80098 20.206 4.00598 18 4.00598C15.794 4.00598 14 5.80098 14 8.00598Z" />
        </svg>
      </button>
    </div>
  );
}
