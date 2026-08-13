import { List, Screen } from '../components/Screen';
import { LogoMark } from '../components/LogoMark';
import { Row } from '../components/Row';
import { SelectControl } from '../components/SelectControl';
import { RANKS, RANKS_SUBTITLE } from '../data/fixtures';
import { directionOf, formatScore, formatSignedPercentWhole } from '../format';
import type { Scheme } from '../useTheme';
import { useSelection } from '../useSelection';

interface RanksScreenProps {
  scheme: Scheme;
  onToggleScheme: () => void;
}

export function RanksScreen({ scheme, onToggleScheme }: RanksScreenProps) {
  const selection = useSelection();

  return (
    <Screen
      title="Ranks"
      subtitle={RANKS_SUBTITLE}
      scheme={scheme}
      onToggleScheme={onToggleScheme}
    >
      <List>
        {RANKS.map((stock) => (
          <Row
            key={stock.symbol}
            lead={String(stock.rank)}
            media={<LogoMark symbol={stock.symbol} />}
            primary={stock.symbol}
            value={formatScore(stock.momentum)}
            meta={formatSignedPercentWhole(stock.return12m)}
            metaDirection={directionOf(stock.return12m)}
            trailing={
              <SelectControl
                selected={selection.isSelected(stock.symbol)}
                label={stock.name}
                onToggle={() => selection.toggle(stock.symbol)}
              />
            }
            // Opens ticker detail in a later phase. Inert for now, but the
            // row still responds to a press so the affordance reads true.
            onActivate={() => {}}
          />
        ))}
      </List>
    </Screen>
  );
}
