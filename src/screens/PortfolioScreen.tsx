import { List, Screen, SectionLabel } from '../components/Screen';
import { Row } from '../components/Row';
import { SelectControl } from '../components/SelectControl';
import { formatWeight } from '../format';
import { toggleSelection, useSelectedSymbols } from '../selectionStore';
import { portfolioFor, totalWeight } from '../weights';
import type { Scheme } from '../useTheme';
import styles from './PortfolioScreen.module.css';

interface PortfolioScreenProps {
  scheme: Scheme;
  onToggleScheme: () => void;
}

export function PortfolioScreen({ scheme, onToggleScheme }: PortfolioScreenProps) {
  // The same store Ranks and ticker detail write to, so adding or removing a
  // stock anywhere re-weights this screen on the spot.
  const selected = useSelectedSymbols();
  const holdings = portfolioFor(selected);

  return (
    <Screen title="Portfolio" scheme={scheme} onToggleScheme={onToggleScheme}>
      {holdings.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No stocks selected</p>
          <p className={styles.emptyBody}>
            Choose stocks in Ranks and they appear here, weighted automatically.
          </p>
        </div>
      ) : (
        <>
          <section className={styles.summary}>
            <div className={`${styles.value} tnum`}>
              {formatWeight(totalWeight(holdings))}
            </div>
            <p className={styles.caption}>
              {holdings.length === 1 ? '1 holding' : `${holdings.length} holdings`} ·
              equal weight
            </p>
          </section>

          <SectionLabel>Holdings</SectionLabel>
          <List>
            {holdings.map((holding) => (
              <Row
                key={holding.symbol}
                primary={holding.symbol}
                secondary={holding.name}
                value={formatWeight(holding.weight)}
                trailing={
                  <SelectControl
                    selected
                    label={holding.name}
                    onToggle={() => toggleSelection(holding.symbol)}
                  />
                }
              />
            ))}
          </List>
          <p className={styles.footnote}>
            Weights are set automatically and always total 100%.
          </p>
        </>
      )}
    </Screen>
  );
}
