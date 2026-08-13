import { List, Screen } from '../components/Screen';
import { LogoMark } from '../components/LogoMark';
import { Row } from '../components/Row';
import { SelectControl } from '../components/SelectControl';
import { RANKS, RANKS_SUBTITLE } from '../data/market';
import { directionOf, formatMoney, formatSignedPercent } from '../format';
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
            media={<LogoMark symbol={stock.symbol} name={stock.name} />}
            primary={stock.symbol}
            value={formatMoney(stock.price)}
            meta={formatSignedPercent(stock.dayChange)}
            metaDirection={directionOf(stock.dayChange)}
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
