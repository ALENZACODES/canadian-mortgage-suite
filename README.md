# Canadian Mortgage Calculator Suite

Live: https://jk-cu-ms-ds.github.io/canadian-mortgage-suite/

Fourteen Canadian home-buying calculators in one fast, private, static web app, built on rules in force as of October 2026 and cited to official sources.

## Calculators
- Affordability at the OSFI stress-test rate (greater of contract + 2% or 5.25%), with GDS 39% / TDS 44%
- Payment for monthly, semi-monthly, bi-weekly, weekly, accelerated bi-weekly and accelerated weekly, with semi-annual compounding
- Land transfer tax for all 10 provinces and 3 territories, Toronto MLTT (2026 luxury tiers), Montreal, and first-time buyer rebates (ON, Toronto, BC, PEI) plus the BC newly built exemption
- Closing costs, including PST on mortgage insurance and GST on new builds
- Mortgage insurance: CMHC tiers, 30-year surcharge for first-time buyers and new builds, $1.5M cap, non-traditional down payment, eco refund, PST in ON, QC and SK
- Stress test checker
- Prepayment penalty: 3 months interest or IRD, including the posted-rate method
- Renewal payment shock and refinance with break-even
- Amortization schedule with extra payments, lump sums, chart and CSV export
- Rent vs buy net worth
- FHSA and RRSP Home Buyers' Plan down payment planner
- First-time home buyers GST/HST rebate on new homes (2026)
- Side-by-side scenario comparison
- Sources panel with as-of dates

Share links, PDF report (print), dark mode, keyboard-navigable tabs, mobile-first layout. No tracking, no sign-up, nothing leaves the browser.

## Run and test
Open `index.html`, or serve the folder. Tests: `node test.js`.

## Files
- `rules.js` rule tables and rates
- `calc.js` formulas (browser and Node)
- `sources.js` citations
- `app.js`, `index.html`, `style.css` interface
- `test.js` unit tests

Educational only, not financial advice. John Khan.

MIT License.
