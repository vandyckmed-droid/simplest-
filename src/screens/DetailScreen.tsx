import { useCallback, useEffect, useRef, useState } from 'react';
import { PriceGraph } from '../components/PriceGraph';
import { SelectControl } from '../components/SelectControl';
import { WindowPicker } from '../components/WindowPicker';
import {
  DEFAULT_WINDOW,
  RANKS,
  formatAsOf,
  formatAsOfLong,
  rangeFor,
  seriesFor,
} from '../data/market';
import {
  directionOf,
  formatMoney,
  formatPercentile,
  formatRatio,
  formatScore,
  formatSignedPercent,
  formatSignedPercentWhole,
} from '../format';
import { toggleSelection, useSelectedSymbols } from '../selectionStore';
import type { MomentumWindow, WindowId } from '../types';
import { useSwipe } from '../useSwipe';
import styles from './DetailScreen.module.css';

interface DetailScreenProps {
  symbol: string;
  onClose: () => void;
  onNavigate: (symbol: string) => void;
}

type Direction = 'next' | 'prev' | 'none';

/** Shown where a figure has not been worked out. */
const PENDING = '—';

/** The three rows describing one momentum window. */
function windowStats(name: string, window: MomentumWindow | null) {
  return [
    {
      label: `${name} Return`,
      value: window ? formatSignedPercentWhole(window.totalReturn) : PENDING,
      lead: false,
    },
    {
      label: `${name} Risk-Adjusted Momentum`,
      value:
        window && window.riskAdjusted !== null ? formatRatio(window.riskAdjusted) : PENDING,
      lead: false,
    },
    {
      label: `${name} Rank`,
      value:
        window && window.percentile !== null ? formatPercentile(window.percentile) : PENDING,
      lead: false,
    },
  ];
}

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
  const range = rangeFor(stock, window_);
  const changeDirection = directionOf(stock.dayChange);
  const long = stock.momentum12_1;
  const short = stock.momentum6_1;

  // The blend leads: it is what the list is ranked by. Its two halves follow.
  const stats = [
    {
      label: 'Momentum Blend',
      value: stock.blend !== null ? formatScore(stock.blend) : PENDING,
      lead: true,
    },
    ...windowStats('12–1', long),
    ...windowStats('6–1', short),
  ];

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
              <span className={styles.period}>{formatAsOf(stock.asOf)} close</span>
            </p>
          </header>

          <div className={styles.graphSlot}>
            <PriceGraph
              points={points}
              label={`${stock.symbol} adjusted close, ${formatAsOfLong(range.from)} to ${formatAsOfLong(range.to)}`}
            />
          </div>

          <WindowPicker active={window_} onSelect={setWindow} />

          <ul className={styles.stats}>
            {stats.map(({ label, value, lead }) => (
              <li key={label}>
                <div className={styles.stat} data-lead={lead || undefined}>
                  <span className={styles.statLabel}>{label}</span>
                  <span
                    className={`${styles.statValue} tnum`}
                    aria-label={value === PENDING ? 'Not yet calculated' : undefined}
                  >
                    {value}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className={styles.footnote}>
            {long && short
              ? `Momentum Blend is half the 12–1 rank plus half the 6–1 rank. 12–1 measures ${formatAsOfLong(long.from)} to ${formatAsOfLong(long.to)}; 6–1 measures ${formatAsOfLong(short.from)} to ${formatAsOfLong(short.to)}. Both skip the most recent month. Risk-adjusted is the window's return divided by its annualised volatility, and each rank is a percentile across the ${RANKS.length} names here.`
              : 'Not enough price history to measure momentum.'}
          </p>
        </article>
      </div>
    </section>
  );
}
