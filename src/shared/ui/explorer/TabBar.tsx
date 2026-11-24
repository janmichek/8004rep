import { useEffect, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type Tab = {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
  tone?: 'warn' | 'bad';
};

type Props = { tabs: Tab[]; label: string; panels: Record<string, ReactNode> };

function askedTab(tabs: Tab[]): string {
  const asked = new URLSearchParams(window.location.search).get('tab');

  return tabs.find((tab) => tab.id === asked)?.id ?? tabs[0]?.id ?? '';
}

/** The open tab lives in `?tab=` so a link reopens the same view. */
export function TabBar({ tabs, label, panels }: Props) {
  const [current, setCurrent] = useState(() => askedTab(tabs));

  useEffect(() => {
    function sync() {
      setCurrent(askedTab(tabs));
    }

    window.addEventListener('popstate', sync);

    return () => window.removeEventListener('popstate', sync);
  }, [tabs]);

  function select(id: string) {
    if (!tabs.some((tab) => tab.id === id)) return;
    setCurrent(id);
    const url = new URL(window.location.href);

    if (id === tabs[0]?.id) url.searchParams.delete('tab');
    else url.searchParams.set('tab', id);
    window.history.replaceState(null, '', url);
  }

  return (
    <div className="tabs">
      <div className="tabbar" role="tablist" aria-label={label}>
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              className="tab"
              data-state={tab.id === current ? 'active' : 'inactive'}
              aria-selected={tab.id === current}
              aria-controls={`panel-${tab.id}`}
              onClick={() => select(tab.id)}
            >
              {Icon ? (
                <Icon className="tab-icon" size={14} strokeWidth={2} aria-hidden="true" />
              ) : null}
              {tab.label}
              {tab.count !== undefined ? (
                <span className={`tab-count${tab.tone ? ` ${tab.tone}` : ''}`}>{tab.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          className="tabpanel"
          data-state={tab.id === current ? 'active' : 'inactive'}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== current}
        >
          {panels[tab.id]}
        </div>
      ))}
    </div>
  );
}
