import { List, Screen, SectionLabel } from '../components/Screen';
import { Row } from '../components/Row';
import { HOLDINGS, PORTFOLIO_SUMMARY } from '../data/fixtures';
import {
  directionOf,
  formatMoney,
  formatSignedMoney,
  formatSignedPercent,
  formatWeight,
} from '../format';
import type { Scheme } from '../useTheme';
import styles from './PortfolioScreen.module.css';

interface PortfolioScreenProps {
  scheme: Scheme;
  onToggleScheme: () => void;
}

export function PortfolioScreen({ scheme, onToggleScheme }: PortfolioScreenProps) {
  const { value, dayChange, dayChangeValue, holdingsLabel, footnote } =
    PORTFOLIO_SUMMARY;

  return (
    <Screen title="Portfolio" scheme={scheme} onToggleScheme={onToggleScheme}>
      <section className={styles.summary}>
        <div className={`${styles.value} tnum`}>{formatMoney(value)}</div>
        <p className={styles.change} data-direction={directionOf(dayChange)}>
          <span className={`${styles.delta} tnum`}>
            {formatSignedMoney(dayChangeValue)} ({formatSignedPercent(dayChange)})
          </span>{' '}
          <span className={styles.period}>Today</span>
        </p>
      </section>

      <SectionLabel>{holdingsLabel}</SectionLabel>
      <List>
        {HOLDINGS.map((holding) => (
          <Row
            key={holding.symbol}
            primary={holding.symbol}
            secondary={holding.name}
            value={formatWeight(holding.weight)}
            meta={formatMoney(holding.value)}
          />
        ))}
      </List>
      <p className={styles.footnote}>{footnote}</p>
    </Screen>
  );
}
