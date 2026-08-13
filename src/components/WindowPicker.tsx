import { WINDOWS } from '../data/series';
import type { WindowId } from '../types';
import styles from './WindowPicker.module.css';

interface WindowPickerProps {
  active: WindowId;
  onSelect: (window: WindowId) => void;
}

export function WindowPicker({ active, onSelect }: WindowPickerProps) {
  return (
    <div className={styles.picker} role="group" aria-label="Graph window">
      {WINDOWS.map((window) => (
        <button
          key={window}
          type="button"
          className={styles.option}
          aria-pressed={window === active}
          onClick={() => onSelect(window)}
        >
          {window}
        </button>
      ))}
    </div>
  );
}
