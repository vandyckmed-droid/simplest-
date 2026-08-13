import { List, Screen } from '../components/Screen';
import { LogoMark } from '../components/LogoMark';
import { Row } from '../components/Row';
import { SelectControl } from '../components/SelectControl';
import { RANKS, RANKS_SUBTITLE } from '../data/market';
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
            media={<LogoMark symbol={stock.symbol} name={stock.name} />}
            primary={stock.symbol}
            value={stock.blend !== null ? formatScore(stock.blend) : '—'}
            meta={
              stock.momentum12_1
                ? formatSignedPercentWhole(stock.momentum12_1.totalReturn)
                : '—'
            }
            metaDirection={
              stock.momentum12_1
                ? directionOf(stock.momentum12_1.totalReturn)
                : undefined
            }
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
