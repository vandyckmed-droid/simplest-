// Top holdings per fund, hand-supplied.
//
// FMP's ETF holdings endpoint is restricted on this key — it answers 402
// "Restricted Endpoint" rather than 404 — so there is no way to fetch these.
// They are transcribed from the fund's own holdings page.
//
// Two things follow from that, and the page says both out loud rather than
// implying a completeness it does not have:
//
//   - **These are top-ten lists, not books.** XHS's ten rows are 22.4% of the
//     fund; the other ~78% is unmapped. Any figure computed across them is a
//     sample of the largest positions, not a total, and the largest positions
//     of a modified-equal-weight fund are barely larger than its smallest.
//   - **Weights are current, momentum is historical.** A name the fund bought
//     last month is credited here with a year of returns the fund did not hold
//     through.
//
// Weights are per cent of the fund. Symbols are matched against the stock
// universe at render time; ones that miss are kept and marked, since a hole in
// the mapping is information about the fund's book too.
//
// A row may carry a third element saying *why* it will not match. Without one
// the page says only that the name is not in the stock universe, which is all
// it can honestly infer — a miss is usually the $25M liquidity floor, but
// CRAK's book is largely foreign lines (RIGD is a London GDR, 5020 is Tokyo,
// 096770 is Seoul) that were never candidates for a US-listed universe, and
// calling those thin would be wrong. The three US names that do miss are all
// liquidity: USPH at $14M a day, CON at $24.5M and AMLX at $24.7M against a
// $25M floor — two of them missing by less than a rounding error, which is
// worth seeing rather than reading as "not tradeable".

export const ETF_HOLDINGS = {
  XHS: {
    asOf: '2026-08-12',
    holdings: [
      ['THC', 2.50],
      ['LFST', 2.40],
      ['HNGE', 2.34],
      ['NEO', 2.34],
      ['WGS', 2.27],
      ['PACS', 2.24],
      ['ACHC', 2.11],
      ['RDNT', 2.11],
      ['USPH', 2.06, '$14M/day, under the $25M floor'],
      ['CON', 2.03, '$24.5M/day, just under the $25M floor'],
    ],
  },

  IHF: {
    asOf: '2026-08-09',
    holdings: [
      ['UNH', 20.91],
      ['CVS', 13.28],
      ['ELV', 7.11],
      ['VEEV', 5.11],
      ['HCA', 4.62],
      ['HUM', 4.41],
      ['CNC', 4.25],
      ['CI', 3.92],
      ['LH', 3.82],
      ['DGX', 3.81],
    ],
  },

  // Refining is a global business and the fund is built like one: six of these
  // ten are foreign lines, so the top ten covers 57.7% of the fund but only
  // 26.9% of it lands in a US-listed universe.
  CRAK: {
    asOf: '2026-08-09',
    holdings: [
      ['MPC', 8.35],
      ['VLO', 7.33],
      ['RIGD', 7.16, 'Reliance Industries GDR, London'],
      ['PSX', 6.61],
      ['PKN', 5.32, 'Orlen, Warsaw'],
      ['NESTE', 4.82, 'Neste, Helsinki'],
      ['DINO', 4.65],
      ['5020', 4.57, 'ENEOS, Tokyo'],
      ['096770', 4.55, 'SK Innovation, Seoul'],
      ['MOL', 4.37, 'MOL, Budapest'],
    ],
  },

  // A "residential and specialized" fund that is a quarter one name: WELL is
  // 24% of it, and healthcare REITs plus self-storage outweigh the apartment
  // landlords the theme label implies.
  REZ: {
    asOf: '2026-08-10',
    holdings: [
      ['WELL', 24.00],
      ['PSA', 10.08],
      ['VTR', 7.77],
      ['EXR', 5.67],
      ['AVB', 4.21],
      ['EQR', 4.20],
      ['ESS', 3.80],
      ['INVH', 3.71],
      ['MAA', 3.20],
      ['SUI', 3.05],
    ],
  },

  XPH: {
    asOf: '2026-08-09',
    holdings: [
      ['CRNX', 3.60],
      ['MBX', 3.13],
      ['DFTX', 2.85],
      ['ATAI', 2.81],
      ['AMLX', 2.47, '$24.7M/day, just under the $25M floor'],
      ['ELVN', 2.36],
      ['CORT', 2.14],
      ['NUVB', 2.11],
      ['LQDA', 2.05],
      ['ALMS', 2.01],
    ],
  },
};
