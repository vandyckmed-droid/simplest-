// Number and date formatting. Consistent everywhere, so a percentage always
// looks like a percentage no matter which screen renders it.

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

export function pct(x, dp = 1) {
  if (!isNum(x)) return '—';
  return `${(x * 100).toFixed(dp)}%`;
}

export function pctSigned(x, dp = 1) {
  if (!isNum(x)) return '—';
  const v = x * 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(dp)}%`;
}

export function num(x, dp = 2) {
  if (!isNum(x)) return '—';
  return x.toFixed(dp);
}

export function signed(x, dp = 2) {
  if (!isNum(x)) return '—';
  return `${x > 0 ? '+' : ''}${x.toFixed(dp)}`;
}

export function money(x, dp = 2) {
  if (!isNum(x)) return '—';
  const abs = Math.abs(x);
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return `${x < 0 ? '-' : ''}$${s}`;
}

export function money0(x) {
  if (!isNum(x)) return '—';
  return `${x < 0 ? '-' : ''}$${Math.round(Math.abs(x)).toLocaleString('en-US')}`;
}

export function compactMoney(x) {
  if (!isNum(x)) return '—';
  const a = Math.abs(x);
  if (a >= 1e12) return `$${(x / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(x / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(x / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(x / 1e3).toFixed(1)}K`;
  return `$${x.toFixed(0)}`;
}

export function rankLabel(rank, of) {
  if (!isNum(rank)) return '—';
  return isNum(of) ? `${rank} / ${of}` : String(rank);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Dates arrive as plain YYYY-MM-DD strings. Parsing them by hand avoids the
// timezone shift that `new Date('2026-08-10')` introduces on some devices.
export function parseDate(iso) {
  if (typeof iso !== 'string') return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

export function shortDate(iso) {
  const p = parseDate(iso);
  if (!p) return '—';
  return `${MONTHS[p.m - 1]} ${p.d}`;
}

export function mediumDate(iso) {
  const p = parseDate(iso);
  if (!p) return '—';
  return `${MONTHS[p.m - 1]} ${p.d}, ${p.y}`;
}

export function monthYear(iso) {
  const p = parseDate(iso);
  if (!p) return '';
  return `${MONTHS[p.m - 1]} ’${String(p.y).slice(2)}`;
}

export function relativeTime(isoTimestamp) {
  const then = Date.parse(isoTimestamp);
  if (!Number.isFinite(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

export function zLabel(z) {
  if (!isNum(z)) return '—';
  return `${z > 0 ? '+' : ''}${z.toFixed(2)}σ`;
}

// "Top 8%" reads better than "rank 22 of 275" on a dense card.
export function percentileLabel(rank, of) {
  if (!isNum(rank) || !isNum(of) || of <= 0) return '';
  const p = Math.round((rank / of) * 100);
  return `Top ${Math.max(1, p)}%`;
}
