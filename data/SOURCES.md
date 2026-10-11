# Market Data sources (retrieved 2026-10-10)

| File | Source | Series / ID | URL |
|---|---|---|---|
| boc-policy-rate.json | Bank of Canada Valet | V39079 (daily, 2009-04-21+); STATIC_ATABLE_V39079 (month-end, 2000-01→2009-03; dates are month precision, flagged) | https://www.bankofcanada.ca/valet/observations/V39079/json , https://www.bankofcanada.ca/valet/observations/STATIC_ATABLE_V39079/json |
| mortgage-rates-national.json | Bank of Canada Valet | V80691335 conventional 5-yr posted (weekly); V80691311 prime (weekly) | https://www.bankofcanada.ca/valet/observations/V80691311,V80691335/json?start_date=2020-01-01 |
| mortgage-rates-national.json | Bank of Canada Valet | FVI_MTG_RATE_5Y_FIX, FVI_MTG_RATE_5Y_VAR (typical insured 5-yr fixed/variable) | https://www.bankofcanada.ca/valet/observations/FVI_MTG_RATE_5Y_FIX/json |
| mortgage-rates-national.json | Statistics Canada | 34-10-0145-01 | https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410014501 |
| household-finances.json | Statistics Canada | 11-10-0065-01: disposable income v1001696801, debt service ratio v1001696813 | https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1110006501 |
| household-finances.json | Statistics Canada | 38-10-0235-01: household debt to disposable income v62698063 | https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3810023501 |
| household-finances.json | Statistics Canada | 36-10-0580-01: household net worth (market value) v62694002 | https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610058001 |
| home-prices-cma.json | CREA MLS® HPI | MLS_HPI_Sept_2026.zip, "Seasonally Adjusted (M)", Composite_HPI_SA + Composite_Benchmark_SA | https://www.crea.ca/files/mls-hpi-data/MLS_HPI_Sept_2026.zip |
| home-prices-cma.json | Statistics Canada | 18-10-0205-01 NHPI, Total (house and land); vectors per city in file | https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810020501 |
| big6-posted-rates.json | RBC rate page + Wayback snapshots (each point carries its snapshot URL) | — | https://web.archive.org/cdx/search/cdx?url=rbcroyalbank.com/mortgages/mortgage-rates.html |
| private-mortgage-rates.json | ESTIMATED RANGE from published sources, not an official index; per-point URLs in file | — | https://www.mortgagesquad.ca/private-mortgage-rates , https://bestrates.ca/private-mortgage-rates-ontario , https://www.canadianmortgagetrends.com/2026/09/private-lenders-warn-brokers-to-look-beyond-mortgage-rates/ , https://www.fsrao.ca/media/28331/download |

StatCan data fetched via WDS getFullTableDownloadCSV. Terms: BoC https://www.bankofcanada.ca/terms/ ; StatCan Open Licence; CREA MLS® HPI (attribute "MLS® HPI, CREA").

## Update 2026-10-10 (pass 2)

- big6-posted-rates.json: each point's Wayback snapshot URL is stored in the file. Pages: RBC https://www.rbcroyalbank.com/mortgages/mortgage-rates.html ; TD https://www.td.com/ca/en/personal-banking/products/mortgages/mortgage-rates ; Scotiabank https://www.scotiabank.com/ca/en/personal/rates-prices/mortgages-rates.html ; BMO https://www.bmo.com/main/personal/mortgages/mortgage-rates/ ; CIBC https://www.cibc.com/en/interest-rates/mortgage-rates.html ; National Bank https://www.nbc.ca/personal/mortgages/rates.html . Rendered via headless Chromium (playwright); validated against BoC V80691311 / V80691335.
- private-mortgage-rates.json (ESTIMATED RANGE from published sources, not an official index):
  - CMHC Residential Mortgage Industry Reports (top-25 MIC tables): 2020 https://assets.cmhc-schl.gc.ca/sites/cmhc/professional/housing-markets-data-and-research/housing-research/research-reports/housing-finance/residential-mortgage-industry-report/2020/residential-mortgage-industry-report-2020-en.pdf ; Fall 2022 .../2022/residential-mortgage-industry-report-fall-2022-en.pdf ; Spring 2023 .../2023/residential-mortgage-industry-report-spring-2023-en.pdf (its "Q3-2023" column header is a typo for Q3-2022; values match Fall 2023) ; Fall 2023 .../2023/residential-mortgage-industry-report-fall-2023-en.pdf ; Spring 2024 .../2024/residential-mortgage-industry-report-spring-2024-en.pdf ; Fall 2024 .../2024/residential-mortgage-industry-report-fall-2024-en.pdf
  - WOWA https://wowa.ca/private-mortgage-rates (live, "as of October 8, 2026") and Wayback 20210418115501, 20211024061916, 20231211191252, 20251108131920
- household-finances.json: outlier_notes added (no new sources).
- source-screenshots/: internal records only, NOT for publication or public repos. Add this folder to .gitignore before any push.
