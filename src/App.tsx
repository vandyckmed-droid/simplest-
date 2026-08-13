import { useEffect, useRef, useState } from 'react';
import { TabBar } from './components/TabBar';
import { PortfolioScreen } from './screens/PortfolioScreen';
import { RanksScreen } from './screens/RanksScreen';
import type { TabId } from './types';
import { useTheme } from './useTheme';
import styles from './App.module.css';

export default function App() {
  const [tab, setTab] = useState<TabId>('ranks');
  const { scheme, toggle } = useTheme();
  const panel = useRef<HTMLDivElement>(null);

  // Each screen opens at its top, the way a native tab switch behaves.
  useEffect(() => {
    panel.current?.scrollTo(0, 0);
  }, [tab]);

  return (
    <div className={styles.app}>
      <div
        ref={panel}
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className={styles.panel}
      >
        {tab === 'ranks' ? (
          <RanksScreen scheme={scheme} onToggleScheme={toggle} />
        ) : (
          <PortfolioScreen scheme={scheme} onToggleScheme={toggle} />
        )}
      </div>
      <TabBar active={tab} onSelect={setTab} />
    </div>
  );
}
