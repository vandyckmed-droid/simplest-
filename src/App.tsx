import { useEffect, useRef, useState } from 'react';
import { TabBar } from './components/TabBar';
import { DetailScreen } from './screens/DetailScreen';
import { PortfolioScreen } from './screens/PortfolioScreen';
import { RanksScreen } from './screens/RanksScreen';
import type { TabId } from './types';
import { useTheme } from './useTheme';
import styles from './App.module.css';

export default function App() {
  const [tab, setTab] = useState<TabId>('ranks');
  // The symbol whose detail is open, or null for the tab screens. Detail is
  // an overlay rather than a third tab, so Ranks keeps its scroll position
  // underneath and returns to exactly where it was.
  const [detail, setDetail] = useState<string | null>(null);
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
        aria-hidden={detail !== null}
      >
        {tab === 'ranks' ? (
          <RanksScreen scheme={scheme} onToggleScheme={toggle} onOpen={setDetail} />
        ) : (
          <PortfolioScreen scheme={scheme} onToggleScheme={toggle} />
        )}
      </div>

      <TabBar active={tab} onSelect={setTab} hidden={detail !== null} />

      {detail && (
        <DetailScreen
          symbol={detail}
          onClose={() => setDetail(null)}
          onNavigate={setDetail}
        />
      )}
    </div>
  );
}
