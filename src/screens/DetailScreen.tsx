import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
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
import type { MomentumWindow, Stock, WindowId } from '../types';
import { useCarousel } from '../useCarousel';
import styles from './DetailScreen.module.css';

interface DetailScreenProps {
  symbol: string;
  onClose: () => void;
  onNavigate: (symbol: string) => void;
}

/** Shown where a figure has not been worked out. */
const PENDING = '—';

/**
 * How many pages either side of the visible one are filled in.
 *
 * The pane elements themselves are all mounted and never move, so nothing
 * ever restarts an animation. Only their contents wait: filling fifty pages
 * at once costs well over a second on a mid-range phone. One either side is
 * enough that the page you swipe to was always already built, so arriving on
 * it never replays the chart's draw.
 */
const NEAR = 1;

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
  const index = RANKS.findIndex((s) => s.symbol === symbol);

  const goTo = useCallback(
    (next: number) => {
      const target = RANKS[next];
      if (target) onNavigate(target.symbol);
    },
    [onNavigate],
  );

  const { rootRef, offset, settling } = useCarousel(index, RANKS.length, goTo);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') goTo(index + 1);
      if (event.key === 'ArrowLeft') goTo(index - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [goTo, index, onClose]);

  const selected = useSelectedSymbols();
  const stock = RANKS[index];
  if (!stock) return null;

  // Every stock is mounted once, in order. Nothing is ever moved in the DOM:
  // re-inserting a node restarts its CSS animations, which would replay the
  // chart's draw on each swipe.
  const paneWidth = 100 / RANKS.length;

  return (
    <section
      className={styles.overlay}
      aria-label={`${stock.name} detail`}
      ref={rootRef as RefObject<HTMLElement>}
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

      <div className={styles.viewport}>
        <div
          className={settling ? `${styles.track} ${styles.settling}` : styles.track}
          style={{
            width: `${RANKS.length * 100}%`,
            transform: `translate3d(calc(${-paneWidth * index}% + ${offset}px), 0, 0)`,
          }}
        >
          {RANKS.map((pane) => (
            <div
              className={styles.pane}
              key={pane.symbol}
              style={{ width: `${paneWidth}%` }}
              aria-hidden={pane !== stock}
            >
              {Math.abs(pane.rank - stock.rank) <= NEAR && (
                <TickerPage
                  stock={pane}
                  window={window_}
                  onSelectWindow={setWindow}
                  active={pane === stock}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface TickerPageProps {
  stock: Stock;
  window: WindowId;
  onSelectWindow: (window: WindowId) => void;
  active: boolean;
}

function TickerPage({ stock, window, onSelectWindow, active }: TickerPageProps) {
  const points = seriesFor(stock, window);
  const range = rangeFor(stock, window);
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
    <article className={styles.page}>
      <header className={styles.identity}>
        <h1 className={styles.ticker}>{stock.symbol}</h1>
        <p className={styles.company}>{stock.name}</p>
        <div className={`${styles.price} tnum`}>{formatMoney(stock.price)}</div>
        <p className={styles.change} data-direction={directionOf(stock.dayChange)}>
          <span className="tnum">{formatSignedPercent(stock.dayChange)}</span>{' '}
          <span className={styles.period}>{formatAsOf(stock.asOf)} close</span>
        </p>
      </header>

      <div className={styles.graphSlot}>
        <PriceGraph
          points={points}
          label={`${stock.symbol} adjusted close, ${formatAsOfLong(range.from)} to ${formatAsOfLong(range.to)}`}
          // Remounting the line redraws it. Keyed on the window alone, so
          // changing span animates while swiping between stocks does not.
          drawKey={window}
        />
      </div>

      <WindowPicker
        active={window}
        onSelect={onSelectWindow}
        // Only the page you can see takes a tap or the keyboard.
        disabled={!active}
      />

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
  );
}
