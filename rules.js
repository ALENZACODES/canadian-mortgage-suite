/* Canadian Mortgage Calculator Suite - rule tables (as of 2026-10-10). */
(function (root) {
  'use strict';
  var AS_OF = '2026-10-10';
  var RULES = {
    asOf: AS_OF,
    stressTest: { buffer: 2.0, floor: 5.25 },
    debtLimits: { gds: 39, tds: 44 },
    insurance: {
      maxPrice: 1500000,
      tiers: [
        { maxLtv: 65, rate: 0.60 }, { maxLtv: 75, rate: 1.70 }, { maxLtv: 80, rate: 2.40 },
        { maxLtv: 85, rate: 2.80 }, { maxLtv: 90, rate: 3.10 }, { maxLtv: 95, rate: 4.00 }
      ],
      nonTraditional95: 4.50,
      surcharge30yr: 0.20,
      ecoRefund: 0.25,
      pst: { ON: 8, QC: 9, SK: 6 }
    },
    minDown: { firstTier: 500000, firstPct: 5, secondPct: 10, uninsuredPct: 20 },
    amortization: { insuredStandard: 25, insuredExtended: 30, uninsuredMax: 30 },
    fhsa: { annual: 8000, lifetime: 40000, carryMax: 8000 },
    hbp: { max: 60000, repayYears: 15 },
    gstNewHome: { rate: 5, fthbMax: 50000, fullTo: 1000000, zeroAt: 1500000 },
    ltt: {
      ON: { brackets: [[55000, 0.5], [250000, 1.0], [400000, 1.5], [2000000, 2.0], [Infinity, 2.5]], ftbMax: 4000 },
      TOR: { brackets: [[55000, 0.5], [250000, 1.0], [400000, 1.5], [2000000, 2.0], [3000000, 2.5], [4000000, 4.4], [5000000, 5.45], [10000000, 6.5], [20000000, 7.55], [Infinity, 8.6]], ftbMax: 4475 },
      BC: { brackets: [[200000, 1], [2000000, 2], [3000000, 3], [Infinity, 5]], ftbFull: 500000, ftbPhaseTo: 835000, ftbPhaseEnd: 860000, newFull: 1100000, newPhaseEnd: 1150000 },
      QC: { brackets: [[62900, 0.5], [315000, 1.0], [Infinity, 1.5]] },
      MTL: { brackets: [[62900, 0.5], [315000, 1.0], [552300, 1.5], [1104700, 2.0], [2136500, 2.5], [3113000, 3.5], [Infinity, 4.0]] },
      MB: { brackets: [[30000, 0], [90000, 0.5], [150000, 1.0], [200000, 1.5], [Infinity, 2.0]] },
      SK: { freeTo: 500, flatTo: 6300, flatFee: 25, titleRate: 0.4 },
      AB: { titleBase: 50, mortBase: 50, perUnit: 5, unit: 5000 },
      NB: { rate: 1.0 },
      NS: { rate: 1.5, note: 'Municipal deed transfer tax; Halifax rate shown, others 0.5% to 1.5%.' },
      PE: { rate: 1.0, exemptBelow: 30000 },
      NL: { base: 100, rate: 0.4, over: 500 },
      YT: { fixed: true },
      NT: { fixed: true },
      NU: { fixed: true }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = RULES; else root.CMCS_RULES = RULES;
})(this);
