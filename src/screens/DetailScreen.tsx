import { useCallback, useEffect, useRef, useState } from 'react';
import { PriceGraph } from '../components/PriceGraph';
import { SelectControl } from '../components/SelectControl';
import { WindowPicker } from '../components/WindowPicker';
import { RANKS } from '../data/fixtures';
import { DEFAULT_WINDOW, seriesFor } from '../data/series';
import {
  directionOf,
  formatMoney,
  formatScore,
  formatSignedPercent,
  formatSignedPercentWhole,
  formatWeight,
} from '../format';
import { toggleSelection, useSelectedSymbols } from '../selectionStore';
import type { WindowId } from '../types';
import { useSwipe } from '../useSwipe';
import styles from './DetailScreen.module.css';

interface DetailScreenProps {
  symbol: string;
  onClose: () => void;
  onNavigate: (symbol: string) => void;
}

type Direction = 'next' | 'prev' | 'none';

export function DetailScreen({ symbol, onClose, onNavigate }: DetailScreenProps) {
  // The window is chosen once per visit and kept while swiping between
  // stocks, so the same span is compared like for like.
  const [window_, setWindow] = useState<WindowId>(DEFAULT_WINDOW);
  const [direction, setDirection] = useState<Direction>('none');
  const scroll = useRef<HTMLDivElement>(null);

  const index = RANKS.findIndex((s) => s.symbol === symbol);
  const stock = RANKS[index];

  const go = useCallback(
    (step: 1 | -1) => {
      const target = RANKS[index + step];
      if (!target) return;
      setDirection(step === 1 ? 'next' : 'prev');
      onNavigate(target.symbol);
      scroll.current?.scrollTo(0, 0);
    },
    [index, onNavigate],
  );

  const swipe = useSwipe(
    () => go(1),
    () => go(-1),
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  const selected = useSelectedSymbols();

  if (!stock) return null;

  const points = seriesFor(stock, window_);
  const changeDirection = directionOf(stock.dayChange);

  return (
    <section
      className={styles.overlay}
      aria-label={`${stock.name} detail`}
      {...swipe}
    >
      <div className={styles.bar}>
        <button
          type="button"
          className={styles.back}
          onClick={onClose}
          aria-label="Back to Ranks"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15 4.5 7.5 12l7.5 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className={styles.position}>
          {stock.rank} of {RANKS.length}
        </span>
        <SelectControl
          selected={selected.includes(stock.symbol)}
          label={stock.name}
          onToggle={() => toggleSelection(stock.symbol)}
        />
      </div>

      <div className={styles.scroll} ref={scroll}>
        <article className={styles.page} data-direction={direction} key={stock.symbol}>
          <header className={styles.identity}>
            <h1 className={styles.ticker}>{stock.symbol}</h1>
            <p className={styles.company}>{stock.name}</p>
            <div className={`${styles.price} tnum`}>{formatMoney(stock.price)}</div>
            <p className={styles.change} data-direction={changeDirection}>
              <span className="tnum">{formatSignedPercent(stock.dayChange)}</span>{' '}
              <span className={styles.period}>Today</span>
            </p>
          </header>

          <div className={styles.graphSlot}>
            <PriceGraph
              points={points}
              label={`${stock.symbol} price over ${window_}`}
            />
          </div>

          <WindowPicker active={window_} onSelect={setWindow} />

          <ul className={styles.stats}>
            <li>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Momentum Blend</span>
                <span className={`${styles.statValue} tnum`}>
                  {formatScore(stock.momentum)}
                </span>
              </div>
            </li>
            <li>
              <div className={styles.stat}>
                <span className={styles.statLabel}>12–1 Return</span>
                <span className={`${styles.statValue} tnum`}>
                  {formatSignedPercentWhole(stock.return121)}
                </span>
              </div>
            </li>
            <li>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Volatility</span>
                <span className={`${styles.statValue} tnum`}>
                  {formatWeight(stock.volatility)}
                </span>
              </div>
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
