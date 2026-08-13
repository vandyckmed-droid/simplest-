/** Thin stroke icons, sized by the surrounding font-size via `em`. */

interface IconProps {
  size?: number;
}

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function RanksIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <path d="M4 18V11" />
      <path d="M10 18V6" />
      <path d="M16 18v-9" />
      <path d="M22 18V4" />
    </svg>
  );
}

export function PortfolioIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 12V3.75A8.25 8.25 0 0 1 20.25 12Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SunIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <circle cx="12" cy="12" r="4.25" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </svg>
  );
}

export function MoonIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...base}>
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2Z" />
    </svg>
  );
}
