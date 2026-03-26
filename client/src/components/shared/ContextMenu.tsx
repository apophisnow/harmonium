import { useEffect, useRef, type ReactNode } from 'react';

interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  separator?: false;
}

interface ContextMenuSeparator {
  separator: true;
}

type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  header?: ReactNode;
}

interface ContextMenuProps extends ContextMenuState {
  onClose: () => void;
}

export function ContextMenu({ x, y, items, header, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Context menu"
      className="fixed z-50 min-w-[180px] rounded-md bg-th-bg-floating p-1.5 shadow-xl"
      style={{ left: x, top: y }}
    >
      {header && (
        <>
          {header}
          <div className="my-1 h-px bg-th-bg-primary" />
        </>
      )}
      {items.map((item, i) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${i}`}
              className="my-1 h-px bg-th-bg-primary"
            />
          );
        }
        return (
          <button
            key={item.label}
            role="menuitem"
            aria-label={item.label}
            className={`flex w-full items-center rounded px-2 py-1.5 text-sm ${
              item.danger
                ? 'text-th-red hover:bg-th-red hover:text-white'
                : 'text-th-text-primary hover:bg-th-brand hover:text-white'
            } transition-colors`}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
