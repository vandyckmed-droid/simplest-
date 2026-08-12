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
// universe at render time; ones that miss (usually because they sit under the
// $25M median dollar volume floor) are kept and marked, since a hole in the
// mapping is information about the fund's book too.

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
      ['USPH', 2.06],
      ['CON', 2.03],
    ],
  },
};
