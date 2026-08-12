// Turns FMP's raw screener output into a list of things you could actually
// place an order for on a retail platform.
//
// FMP's `country=US` filter is about domicile, not listing venue, so it hands
// back London and Toronto lines for US companies (0YXG.L is Broadcom). It also
// keeps preferred shares, baby bonds and SPAC units, and lists every share
// class of the same company separately. All of that is noise for a ranking.

/** The only venues a US retail account trades directly. */
const US_EXCHANGES = new Set(['NASDAQ', 'NYSE', 'AMEX']);

/**
 * Preferred shares, warrants, units, rights and when-issued lines. These ride
 * on a suffix after a dash or dot: BRK-A is a share class and survives, but
 * FITB-PM (preferred) and KCAC-UN (SPAC unit) do not.
 */
const NON_COMMON = /[-.](P[A-Z]?|U|UN|W|WS|WT|R|RT|RW|WI|CL|V)$/i;

/** Legal-form noise that stops two lines of one company matching by name. */
const NAME_NOISE = [
  /\s+(Class\s+[A-Z]\s+)?(Common\s+(Stock|Shares)|Ordinary\s+Shares)$/i,
  /,?\s+(Inc\.?|Incorporated|Corp\.?|Corporation|Company|Co\.|Ltd\.?|Limited|plc|PLC|LLC|L\.P\.|LP|N\.V\.|S\.A\.|Holdings?|Group)$/i,
  /^The\s+/i,
];

export function normalizeName(name) {
  let out = (name ?? '').trim();
  for (let pass = 0; pass < 4; pass++) {
    const before = out;
    for (const re of NAME_NOISE) out = out.replace(re, '').trim();
    if (out === before) break;
  }
  return out.replace(/[,\s]+$/, '').toLowerCase() || (name ?? '').toLowerCase();
}

const dollarVolume = (r) => (r.price ?? 0) * (r.volume ?? 0);

/**
 * @param {object[]} rows Raw /stable/company-screener rows.
 * @param {{minPrice:number, minDollarVolume:number}} opts
 * @returns {{rows:object[], dropped:Record<string,number>}}
 */
export function clean(rows, { minPrice, minDollarVolume }) {
  const dropped = { exchange: 0, nonCommon: 0, price: 0, thin: 0, duplicate: 0 };
  const kept = [];

  for (const r of rows) {
    if (!US_EXCHANGES.has(r.exchangeShortName)) { dropped.exchange++; continue; }
    if (NON_COMMON.test(r.symbol)) { dropped.nonCommon++; continue; }
    if (!(r.price >= minPrice)) { dropped.price++; continue; }
    if (!(dollarVolume(r) >= minDollarVolume)) { dropped.thin++; continue; }
    kept.push(r);
  }

  // One line per company: whichever class actually carries the volume. This
  // collapses GOOG/GOOGL and FOX/FOXA, and drops preferreds that share a
  // parent's name without carrying a preferred suffix (STRK vs MSTR).
  const best = new Map();
  for (const r of kept) {
    const key = normalizeName(r.companyName);
    const cur = best.get(key);
    if (!cur || dollarVolume(r) > dollarVolume(cur)) {
      if (cur) dropped.duplicate++;
      best.set(key, r);
    } else {
      dropped.duplicate++;
    }
  }

  return { rows: [...best.values()], dropped };
}
