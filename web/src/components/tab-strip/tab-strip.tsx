'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  className?: string;
}

interface TabStripProps {
  label: string;
  // Ties each tab to the one tabpanel the caller renders with tabPanelProps.
  prefix: string;
  items: readonly TabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
  tabClassName?: string;
}

export function tabPanelProps(prefix: string, selectedId: string) {
  return {
    id: `${prefix}-panel`,
    role: 'tabpanel',
    tabIndex: 0,
    'aria-labelledby': `${prefix}-tab-${selectedId}`,
  } as const;
}

export function TabStrip({
  label,
  prefix,
  items,
  selectedId,
  onSelect,
  className,
  tabClassName,
}: Readonly<TabStripProps>) {
  const list = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const position = items.findIndex(({ id }) => id === selectedId);
    const steps: Record<string, number | undefined> = {
      ArrowRight: (position + 1) % items.length,
      ArrowLeft: (position - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    const target = steps[event.key];
    const next = target === undefined ? undefined : items[target];
    if (!next) return;
    event.preventDefault();
    onSelect(next.id);
    list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[target ?? 0]?.focus();
  }

  return (
    <div
      ref={list}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={className}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => (
        <button
          key={item.id}
          id={`${prefix}-tab-${item.id}`}
          type="button"
          role="tab"
          aria-label={item.label}
          aria-selected={item.id === selectedId}
          aria-controls={`${prefix}-panel`}
          tabIndex={item.id === selectedId ? 0 : -1}
          className={[tabClassName, item.className].filter(Boolean).join(' ')}
          onClick={() => {
            onSelect(item.id);
          }}
        >
          {item.content}
        </button>
      ))}
    </div>
  );
}
