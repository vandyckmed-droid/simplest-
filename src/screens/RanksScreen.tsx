import { List, Screen } from '../components/Screen';
import { Row } from '../components/Row';
import { RANKS, RANKS_UNIVERSE_LABEL } from '../data/fixtures';
import { directionOf, formatMoney, formatSignedPercent } from '../format';
import type { Scheme } from '../useTheme';

interface RanksScreenProps {
  scheme: Scheme;
  onToggleScheme: () => void;
}

export function RanksScreen({ scheme, onToggleScheme }: RanksScreenProps) {
  return (
    <Screen
      title="Ranks"
      subtitle={RANKS_UNIVERSE_LABEL}
      scheme={scheme}
      onToggleScheme={onToggleScheme}
    >
      <List>
        {RANKS.map((stock) => (
          <Row
            key={stock.symbol}
            lead={String(stock.rank)}
            primary={stock.symbol}
            secondary={stock.name}
            value={formatMoney(stock.price)}
            meta={formatSignedPercent(stock.dayChange)}
            metaDirection={directionOf(stock.dayChange)}
          />
        ))}
      </List>
    </Screen>
  );
}
