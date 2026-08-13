import type { ComponentType } from 'react';
import { PortfolioIcon, RanksIcon } from './Icons';
import type { TabId } from '../types';
import styles from './TabBar.module.css';

interface Tab {
  id: TabId;
  label: string;
  Icon: ComponentType<{ size?: number }>;
}

const TABS: Tab[] = [
  { id: 'ranks', label: 'Ranks', Icon: RanksIcon },
  { id: 'portfolio', label: 'Portfolio', Icon: PortfolioIcon },
];

interface TabBarProps {
  active: TabId;
  onSelect: (id: TabId) => void;
}

export function TabBar({ active, onSelect }: TabBarProps) {
  return (
    <nav className={styles.bar} role="tablist" aria-label="Sections">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`tab-${id}`}
          aria-selected={active === id}
          aria-controls={`panel-${id}`}
          className={styles.tab}
          onClick={() => onSelect(id)}
        >
          <Icon size={23} />
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
