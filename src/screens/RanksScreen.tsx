import { List, Screen } from '../components/Screen';
import { LogoMark } from '../components/LogoMark';
import { Row } from '../components/Row';
import { SelectControl } from '../components/SelectControl';
import { RANKS, RANKS_SUBTITLE } from '../data/fixtures';
import { directionOf, formatScore, formatSignedPercentWhole } from '../format';
import { toggleSelection, useSelectedSymbols } from '../selectionStore';
import type { Scheme } from '../useTheme';

interface RanksScreenProps {
  scheme: Scheme;
  onToggleScheme: () => void;
  onOpen: (symbol: string) => void;
}

export function RanksScreen({ scheme, onToggleScheme, onOpen }: RanksScreenProps) {
  const selected = useSelectedSymbols();

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
            meta={formatSignedPercentWhole(stock.return121)}
            metaDirection={directionOf(stock.return121)}
            trailing={
              <SelectControl
                selected={selected.includes(stock.symbol)}
                label={stock.name}
                onToggle={() => toggleSelection(stock.symbol)}
              />
            }
            onActivate={() => onOpen(stock.symbol)}
          />
        ))}
      </List>
    </Screen>
  );
}
