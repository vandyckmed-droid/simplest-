import { WINDOWS } from '../data/market';
import type { WindowId } from '../types';
import styles from './WindowPicker.module.css';

interface WindowPickerProps {
  active: WindowId;
  onSelect: (window: WindowId) => void;
  /** True for the off-screen pages either side of the one being read. */
  disabled?: boolean;
}

export function WindowPicker({ active, onSelect, disabled = false }: WindowPickerProps) {
  return (
    <div className={styles.picker} role="group" aria-label="Graph window">
      {WINDOWS.map((window) => (
        <button
          key={window}
          type="button"
          className={styles.option}
          aria-pressed={window === active}
          disabled={disabled}
          tabIndex={disabled ? -1 : undefined}
          onClick={() => onSelect(window)}
        >
          {window}
        </button>
      ))}
    </div>
  );
}
