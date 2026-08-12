// Thematic ETF universe — staged for a Settings toggle that switches the Ranks
// list between single stocks and these funds.
//
// Nothing reads this yet. It is kept as ordered data rather than a flat ticker
// list because the grouping is the point: the same fund shows up under several
// themes (GRID is grid infrastructure, water infrastructure and electrification;
// COPX is a copper miner and a battery-materials play), and which lens you came
// through changes what the fund means to you.
//
// The scoring pipeline needs no changes to accept these — an ETF has adjusted
// closes like anything else. What it does need is a different universe filter,
// since src/universe.js exists specifically to throw funds away.

export const ETF_THEMES = [
  {
    group: 'Broad sectors',
    funds: [
      ['XLC', 'Communication Services'],
      ['XLY', 'Consumer Discretionary'],
      ['XLP', 'Consumer Staples'],
      ['XLE', 'Energy'],
      ['XLF', 'Financials'],
      ['XLV', 'Health Care'],
      ['XLI', 'Industrials'],
      ['XLB', 'Materials'],
      ['XLRE', 'Real Estate'],
      ['XLK', 'Technology'],
      ['XLU', 'Utilities'],
    ],
  },
  {
    group: 'Technology and digital economy',
    funds: [
      ['SMH', 'Semiconductors'],
      ['IGV', 'Software'],
      ['CIBR', 'Cybersecurity'],
      ['SKYY', 'Cloud Computing'],
      ['FDN', 'Internet'],
      ['SOCL', 'Social Media'],
      ['FINX', 'Financial Technology'],
      ['IPAY', 'Digital Payments'],
      ['BLOK', 'Blockchain and Digital Asset Companies'],
      ['AIQ', 'Artificial Intelligence'],
      ['BOTZ', 'Robotics and Industrial Automation'],
      ['QTUM', 'Quantum Computing'],
      ['SNSR', 'Internet of Things'],
      ['VPN', 'Data Centers and Digital Infrastructure'],
      ['IYZ', 'Telecommunications'],
    ],
  },
  {
    group: 'Health care',
    funds: [
      ['XBI', 'Biotechnology'],
      ['XPH', 'Pharmaceuticals'],
      ['XHE', 'Health Care Equipment'],
      ['XHS', 'Health Care Services'],
      ['IHF', 'Health Care Providers'],
      ['ARKG', 'Genomics and Precision Medicine'],
    ],
  },
  {
    group: 'Financials',
    funds: [
      ['KBE', 'Banks'],
      ['KRE', 'Regional Banks'],
      ['KIE', 'Insurance'],
      ['IAI', 'Broker Dealers and Securities Exchanges'],
      ['BIZD', 'Business Development Companies'],
      ['MORT', 'Mortgage REITs'],
    ],
  },
  {
    group: 'Energy and power',
    funds: [
      ['XOP', 'Oil and Gas Exploration and Production'],
      ['XES', 'Oil Equipment and Services'],
      ['CRAK', 'Oil Refining'],
      ['AMLP', 'Midstream and MLP Infrastructure'],
      ['URA', 'Uranium and Nuclear Fuel Cycle'],
      ['TAN', 'Solar Energy'],
      ['FAN', 'Wind Energy'],
      ['PBW', 'Clean Energy'],
      ['GRID', 'Electric Grid Infrastructure'],
    ],
  },
  {
    group: 'Metals, mining and materials',
    funds: [
      ['XME', 'Metals and Mining'],
      ['GDX', 'Gold Miners'],
      ['GDXJ', 'Junior Gold Miners'],
      ['SIL', 'Silver Miners'],
      ['COPX', 'Copper Miners'],
      ['REMX', 'Rare Earth and Strategic Metals'],
      ['LIT', 'Lithium and Battery Materials'],
      ['SLX', 'Steel'],
      ['WOOD', 'Timber and Forestry'],
    ],
  },
  {
    group: 'Industrials, manufacturing and infrastructure',
    funds: [
      ['XAR', 'Aerospace and Defense'],
      ['ITA', 'Aerospace and Defense Large Cap Tilt'],
      ['PAVE', 'U.S. Infrastructure Development'],
      ['IFRA', 'U.S. Infrastructure'],
      ['PKB', 'Building and Construction'],
      ['AIRR', 'U.S. Industrial Reshoring'],
      ['IYT', 'Transportation'],
      ['XTN', 'Transportation Broad Equal Weight'],
      ['JETS', 'Airlines'],
      ['SEA', 'Shipping'],
      ['SHLD', 'Defense Technology'],
    ],
  },
  {
    group: 'Construction, housing and real estate',
    funds: [
      ['XHB', 'Homebuilders and Housing'],
      ['ITB', 'Home Construction'],
      ['REZ', 'Residential and Specialized Real Estate'],
      ['SRVR', 'Data Centers and Digital Infrastructure Real Estate'],
      ['INDS', 'Industrial Real Estate'],
      ['MORT', 'Mortgage REITs'],
    ],
  },
  {
    group: 'Consumer, retail and leisure',
    funds: [
      ['XRT', 'Retail'],
      ['IBUY', 'Online Retail'],
      ['PEJ', 'Leisure and Entertainment'],
      ['JETS', 'Airlines'],
      ['AWAY', 'Travel Technology'],
      ['BETZ', 'Sports Betting and iGaming'],
      ['BJK', 'Gaming and Casinos'],
      ['EATZ', 'Restaurants'],
    ],
  },
  {
    group: 'Communication, media and entertainment',
    funds: [
      ['IYZ', 'Telecommunications'],
      ['SOCL', 'Social Media'],
      ['PBS', 'Media'],
      ['FDN', 'Internet'],
      ['NERD', 'Video Games and Esports'],
    ],
  },
  {
    group: 'Agriculture and food',
    funds: [
      ['MOO', 'Agribusiness'],
      ['VEGI', 'Agricultural Producers'],
      ['PBJ', 'Food and Beverage'],
      ['FTXG', 'Food and Beverage'],
    ],
  },
  {
    group: 'Water and environmental infrastructure',
    funds: [
      ['PHO', 'Water'],
      ['FIW', 'Water'],
      ['AQWA', 'Clean Water'],
      ['GRID', 'Electric Grid Infrastructure'],
    ],
  },
  {
    group: 'Clean energy and electrification',
    funds: [
      ['TAN', 'Solar'],
      ['FAN', 'Wind'],
      ['URA', 'Uranium'],
      ['LIT', 'Lithium and Batteries'],
      ['DRIV', 'Electric and Autonomous Vehicles'],
      ['GRID', 'Smart Grid and Electrical Infrastructure'],
      ['PBW', 'Clean Energy'],
      ['REMX', 'Strategic and Rare Earth Materials'],
      ['COPX', 'Copper Miners'],
    ],
  },
  {
    group: 'Defense, aerospace and space',
    funds: [
      ['XAR', 'Aerospace and Defense'],
      ['UFO', 'Space Economy'],
      ['ARKX', 'Space Exploration'],
      ['SHLD', 'Defense Technology'],
    ],
  },
  {
    group: 'Automation, AI and advanced manufacturing',
    funds: [
      ['BOTZ', 'Robotics and Automation'],
      ['AIQ', 'Artificial Intelligence'],
      ['QTUM', 'Quantum Computing'],
      ['PRNT', '3D Printing'],
      ['SNSR', 'Internet of Things'],
    ],
  },
  {
    group: 'Natural resources',
    funds: [
      ['GUNR', 'Broad Upstream Natural Resources'],
      ['MOO', 'Agribusiness'],
      ['WOOD', 'Timber'],
      ['COPX', 'Copper'],
      ['REMX', 'Rare Earths'],
      ['GDX', 'Gold Miners'],
      ['SIL', 'Silver Miners'],
      ['XME', 'Metals and Mining'],
    ],
  },
];

/**
 * One entry per fund. `label` is the first name the list gives it, which reads
 * as the primary description; `themes` records every group it appears under, so
 * a fund can be filtered by theme without being listed twice in the ranking.
 *
 * @type {Map<string, {label: string, themes: string[], aliases: string[]}>}
 */
export const ETF_UNIVERSE = (() => {
  const out = new Map();
  for (const { group, funds } of ETF_THEMES) {
    for (const [ticker, label] of funds) {
      const seen = out.get(ticker);
      if (!seen) {
        out.set(ticker, { label, themes: [group], aliases: [] });
        continue;
      }
      seen.themes.push(group);
      if (label !== seen.label && !seen.aliases.includes(label)) seen.aliases.push(label);
    }
  }
  return out;
})();

export const ETF_TICKERS = [...ETF_UNIVERSE.keys()];

// What `npm run etf:check` found on 2026-08-12, kept here so the next person to
// pick this up does not rediscover it. Re-run the check before building on it.
//
// 89 of 93 funds score cleanly. The four that do not are listed as given rather
// than quietly swapped out — the list is the user's, and a silent substitution
// is worse than a known gap.
//
//   VPN   quotes but returns no adjusted history. Global X renamed it "Data
//         Center REITs & Digital Infrastructure"; ~25k shares a day. DTCR
//         covers the same theme at ~674k shares a day.
//   PBS   quotes but returns no adjusted history. Invesco Dynamic Media,
//         ~2k shares a day — effectively untradeable.
//   BJK   stopped trading; last bar 2026-05-18.
//   EATZ  stopped trading; last bar 2026-05-07.
//
// Liquidity here is nothing like the stock side. Median daily dollar volume runs
// from NERD at under $0.1M to SMH at $6.5B, and the $25M floor that governs the
// stock universe would delete 39 of the 89 scoreable funds — including most of
// the thematic ones the list exists for. Survivors by floor: $1M -> 76,
// $5M -> 62, $25M -> 50. ETF mode therefore applies no floor at all.
