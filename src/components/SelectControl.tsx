import styles from './SelectControl.module.css';

interface SelectControlProps {
  selected: boolean;
  /** Company name, so the control reads as "Select NVIDIA" to a screen reader. */
  label: string;
  onToggle: () => void;
}

export function SelectControl({ selected, label, onToggle }: SelectControlProps) {
  return (
    <button
      type="button"
      className={styles.control}
      aria-pressed={selected}
      aria-label={selected ? `Deselect ${label}` : `Select ${label}`}
      onClick={(event) => {
        // Selecting is not the same tap as opening the row.
        event.stopPropagation();
        onToggle();
      }}
    >
      <span className={styles.disc}>
        {selected ? <CheckIcon /> : <PlusIcon />}
      </span>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M7 2.4v9.2M2.4 7h9.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M3 7.4 5.9 10.2 11 3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
