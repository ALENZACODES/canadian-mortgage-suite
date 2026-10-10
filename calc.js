/* Canadian Mortgage Calculator Suite - pure formulas. Works in browsers and Node. */
(function (root) {
  'use strict';
  var R = (typeof module !== 'undefined' && module.exports) ? require('./rules.js') : root.CMCS_RULES;

  function round2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

  /* Canadian fixed-rate mortgages compound semi-annually (Interest Act s.6). */
  function periodicRate(annualPct, periodsPerYear, compounding) {
    var j = annualPct / 100;
    var m = compounding || 2;
    if (j === 0) return 0;
    return Math.pow(1 + j / m, m / periodsPerYear) - 1;
  }

  var FREQUENCIES = {
    monthly: { n: 12, label: 'Monthly' },
    semimonthly: { n: 24, label: 'Semi-monthly' },
    biweekly: { n: 26, label: 'Bi-weekly' },
    weekly: { n: 52, label: 'Weekly' },
    accBiweekly: { n: 26, label: 'Accelerated bi-weekly', acc: 2 },
    accWeekly: { n: 52, label: 'Accelerated weekly', acc: 4 }
  };

  function annuityPayment(principal, rate, n) {
    if (n <= 0) return 0;
    if (rate === 0) return principal / n;
    return principal * rate / (1 - Math.pow(1 + rate, -n));
  }

  function monthlyPayment(principal, annualPct, years, compounding) {
    return annuityPayment(principal, periodicRate(annualPct, 12, compounding), Math.round(years * 12));
  }

  function payment(principal, annualPct, years, freq, compounding) {
    var f = FREQUENCIES[freq] || FREQUENCIES.monthly;
    if (f.acc) return monthlyPayment(principal, annualPct, years, compounding) / f.acc;
    return annuityPayment(principal, periodicRate(annualPct, f.n, compounding), Math.round(years * f.n));
  }

  /* Full amortization schedule with optional lump sums and payment increases. */
  function schedule(opts) {
    var P = opts.principal, freq = opts.freq || 'monthly';
    var f = FREQUENCIES[freq] || FREQUENCIES.monthly;
    var r = periodicRate(opts.rate, f.n, opts.compounding);
    var pmt = opts.payment != null ? opts.payment : payment(P, opts.rate, opts.years, freq, opts.compounding);
    pmt += opts.extraPerPayment || 0;
    var lumpPct = opts.annualLump || 0;
    var rows = [], bal = P, k = 0, totalInt = 0, maxN = Math.round((opts.years || 25) * f.n) + 5 * f.n;
    var termN = opts.termYears ? Math.round(opts.termYears * f.n) : null, termBal = null, termInt = 0;
    while (bal > 0.005 && k < maxN * 2) {
      k++;
      var interest = bal * r;
      var princ = Math.min(pmt - interest, bal);
      if (princ <= 0 && interest > 0) { return { error: 'Payment does not cover interest', rows: rows }; }
      bal -= princ; totalInt += interest;
      var lump = 0;
      if (lumpPct && k % f.n === 0 && bal > 0) { lump = Math.min(bal, lumpPct); bal -= lump; }
      rows.push({ n: k, year: Math.ceil(k / f.n), payment: round2(princ + interest), interest: round2(interest), principal: round2(princ), lump: round2(lump), balance: round2(Math.max(bal, 0)) });
      if (termN && k <= termN) termInt += interest;
      if (termN && k === termN) termBal = Math.max(bal, 0);
    }
    return { payment: round2(pmt), periods: k, years: round2(k / f.n), totalInterest: round2(totalInt), rows: rows, termBalance: termBal == null ? null : round2(termBal), termInterest: round2(termInt) };
  }

  function yearly(rows) {
    var out = {};
    rows.forEach(function (r) {
      var y = out[r.year] || (out[r.year] = { year: r.year, interest: 0, principal: 0, balance: 0 });
      y.interest += r.interest; y.principal += r.principal + r.lump; y.balance = r.balance;
    });
    return Object.keys(out).map(function (k) { var y = out[k]; y.interest = round2(y.interest); y.principal = round2(y.principal); return y; });
  }

  function toCSV(rows) {
    var lines = ['Payment,Year,Payment amount,Interest,Principal,Lump sum,Balance'];
    rows.forEach(function (r) { lines.push([r.n, r.year, r.payment.toFixed(2), r.interest.toFixed(2), r.principal.toFixed(2), r.lump.toFixed(2), r.balance.toFixed(2)].join(',')); });
    return lines.join('\r\n');
  }

  /* OSFI minimum qualifying rate: greater of contract + 2% or 5.25%. */
  function qualifyingRate(contractPct) { return Math.max(contractPct + R.stressTest.buffer, R.stressTest.floor); }

  function minDownPayment(price, opts) {
    opts = opts || {};
    if (price >= R.insurance.maxPrice) return round2(price * R.minDown.uninsuredPct / 100);
    var a = Math.min(price, R.minDown.firstTier) * R.minDown.firstPct / 100;
    var b = Math.max(0, price - R.minDown.firstTier) * R.minDown.secondPct / 100;
    return round2(a + b);
  }

  function maxAmortization(insured, firstTime, newBuild) {
    if (!insured) return R.amortization.uninsuredMax;
    return (firstTime || newBuild) ? R.amortization.insuredExtended : R.amortization.insuredStandard;
  }

  function insurancePremium(o) {
    var price = o.price, down = o.down;
    var loan = price - down;
    var ltv = loan / price * 100;
    var res = { loan: round2(loan), ltv: round2(ltv), rate: 0, premium: 0, pst: 0, insured: false, eligible: true, reasons: [] };
    if (ltv <= 80 && !o.forceInsure) { res.reasons.push('20% or more down: insurance not required'); return res; }
    if (price >= R.insurance.maxPrice) { res.eligible = false; res.reasons.push('Price at or above $1.5M is not insurable'); return res; }
    if (down + 0.005 < minDownPayment(price)) { res.eligible = false; res.reasons.push('Down payment below federal minimum'); return res; }
    var rate = null;
    for (var i = 0; i < R.insurance.tiers.length; i++) { if (ltv <= R.insurance.tiers[i].maxLtv + 1e-9) { rate = R.insurance.tiers[i].rate; break; } }
    if (rate === null) { res.eligible = false; res.reasons.push('LTV above 95%'); return res; }
    if (o.nonTraditional && ltv > 90) rate = R.insurance.nonTraditional95;
    var years = o.amortization || 25;
    if (years > 25) {
      if (!(o.firstTime || o.newBuild)) { res.eligible = false; res.reasons.push('Insured amortization over 25 years needs a first-time buyer or a new build'); return res; }
      rate += R.insurance.surcharge30yr;
    }
    res.insured = true; res.rate = round2(rate);
    res.premium = round2(loan * rate / 100);
    var pstRate = R.insurance.pst[o.province] || 0;
    res.pst = round2(res.premium * pstRate / 100);
    res.pstRate = pstRate;
    res.totalLoan = round2(loan + res.premium);
    if (o.eco) res.ecoRefund = round2(res.premium * R.insurance.ecoRefund);
    return res;
  }

  function bracketTax(value, brackets) {
    var tax = 0, prev = 0;
    for (var i = 0; i < brackets.length; i++) {
      var top = brackets[i][0], rate = brackets[i][1];
      if (value > prev) tax += (Math.min(value, top) - prev) * rate / 100;
      prev = top;
    }
    return tax;
  }

  /* Land transfer tax by province. opts: {province, price, firstTime, newBuild, toronto, montreal, loan} */
  function landTransferTax(o) {
    var L = R.ltt, p = o.price, prov = o.province, out = { provincial: 0, municipal: 0, rebate: 0, notes: [] };
    switch (prov) {
      case 'ON':
        out.provincial = bracketTax(p, L.ON.brackets);
        if (o.firstTime) out.rebate += Math.min(L.ON.ftbMax, out.provincial);
        if (o.toronto) {
          out.municipal = bracketTax(p, L.TOR.brackets);
          if (o.firstTime) out.rebate += Math.min(L.TOR.ftbMax, out.municipal);
        }
        break;
      case 'BC':
        out.provincial = bracketTax(p, L.BC.brackets);
        if (o.newBuild && p <= L.BC.newPhaseEnd) {
          var full = out.provincial;
          var r = p <= L.BC.newFull ? full : full * (L.BC.newPhaseEnd - p) / (L.BC.newPhaseEnd - L.BC.newFull);
          out.rebate = r; out.notes.push('Newly built home exemption');
        } else if (o.firstTime && p < L.BC.ftbPhaseEnd) {
          var onFirst = bracketTax(Math.min(p, L.BC.ftbFull), L.BC.brackets);
          var ex = p <= L.BC.ftbPhaseTo ? onFirst : onFirst * (L.BC.ftbPhaseEnd - p) / (L.BC.ftbPhaseEnd - L.BC.ftbPhaseTo);
          out.rebate = ex; out.notes.push('First time home buyers exemption');
        }
        break;
      case 'QC':
        if (o.montreal) out.municipal = bracketTax(p, L.MTL.brackets); else out.municipal = bracketTax(p, L.QC.brackets);
        out.notes.push('Quebec transfer duties are levied by the municipality');
        break;
      case 'MB': out.provincial = bracketTax(p, L.MB.brackets); break;
      case 'SK': out.provincial = Math.max(0, p - L.SK.titleBase) * L.SK.titleRate / 100; out.notes.push('Land titles fee, not a tax'); break;
      case 'AB':
        out.provincial = L.AB.titleBase + Math.ceil(p / L.AB.unit) * L.AB.perUnit;
        if (o.loan) out.provincial += L.AB.mortBase + Math.ceil(o.loan / L.AB.unit) * L.AB.perUnit;
        out.notes.push('Alberta charges land titles registration fees instead of a tax'); break;
      case 'NB': out.provincial = p * L.NB.rate / 100; break;
      case 'NS': out.municipal = p * L.NS.rate / 100; out.notes.push(L.NS.note); break;
      case 'PE':
        out.provincial = p > L.PE.exemptBelow ? p * L.PE.rate / 100 : 0;
        if (o.firstTime) { out.rebate = out.provincial; out.notes.push('First-time buyer exemption'); }
        break;
      case 'NL': out.provincial = p > L.NL.over ? L.NL.base + (p - L.NL.over) * L.NL.rate / 100 : L.NL.base; out.notes.push('Registration of deed fee'); break;
      case 'YT': out.provincial = yukonFee(p); out.notes.push('Land titles fee'); break;
      case 'NT': out.provincial = ntFee(p); out.notes.push('Land titles fee'); break;
      case 'NU': out.provincial = nuFee(p); out.notes.push('Land titles fee'); break;
    }
    out.provincial = round2(out.provincial); out.municipal = round2(out.municipal); out.rebate = round2(out.rebate);
    out.total = round2(out.provincial + out.municipal - out.rebate);
    return out;
  }
  /* Territorial land titles fee approximations (fee schedules, see Sources). */
  function yukonFee(p) { return round2(50 + Math.ceil(p / 1000) * 0.2 * 1); }
  function ntFee(p) { return round2(p <= 1000000 ? 150 + Math.ceil(Math.max(0, p - 0) / 1000) * 1.5 : 150 + 1500 + Math.ceil((p - 1000000) / 1000) * 1); }
  function nuFee(p) { return round2(p <= 1000000 ? 150 + Math.ceil(p / 1000) * 1.5 : 1650 + Math.ceil((p - 1000000) / 1000) * 1); }

  function closingCosts(o) {
    var ltt = landTransferTax(o);
    var items = [
      { k: 'Land transfer tax (net)', v: ltt.total },
      { k: 'Legal fees and disbursements', v: o.legal != null ? o.legal : 2000 },
      { k: 'Home inspection', v: o.inspection != null ? o.inspection : 500 },
      { k: 'Appraisal', v: o.appraisal != null ? o.appraisal : 350 },
      { k: 'Title insurance', v: o.title != null ? o.title : 350 },
      { k: 'Property tax and utility adjustments', v: o.adjustments != null ? o.adjustments : 1000 },
      { k: 'Moving', v: o.moving != null ? o.moving : 1500 },
      { k: 'PST on mortgage insurance', v: o.insurancePst || 0 }
    ];
    if (o.newBuild) {
      items.push({ k: 'GST/HST net of rebates (new build)', v: o.gstNet || 0 });
      items.push({ k: 'Tarion or warranty enrolment and development levies', v: o.levies != null ? o.levies : 0 });
    }
    var total = items.reduce(function (s, i) { return s + i.v; }, 0);
    return { items: items, total: round2(total), ltt: ltt };
  }

  /* Federal first-time home buyers GST rebate (Bill C-4, royal assent 2026-03-13). */
  function fthbGstRebate(price) {
    var G = R.gstNewHome, gst = price * G.rate / 100, max = Math.min(G.fthbMax, gst);
    if (price <= G.fullTo) return round2(max);
    if (price >= G.zeroAt) return 0;
    return round2(max * (G.zeroAt - price) / (G.zeroAt - G.fullTo));
  }

  function debtRatios(o) {
    var qr = o.qualify === false ? o.rate : qualifyingRate(o.rate);
    var pmt = monthlyPayment(o.loan, qr, o.years);
    var housing = pmt + (o.propertyTax || 0) / 12 + (o.heat || 0) + (o.condoFees || 0) * 0.5;
    var inc = o.income / 12;
    var gds = housing / inc * 100, tds = (housing + (o.debts || 0)) / inc * 100;
    return { qualifyingRate: qr, payment: round2(pmt), gds: round2(gds), tds: round2(tds), pass: gds <= R.debtLimits.gds && tds <= R.debtLimits.tds };
  }

  function maxLoanForPayment(pmt, annualPct, years) {
    var r = periodicRate(annualPct, 12), n = Math.round(years * 12);
    return r === 0 ? pmt * n : pmt * (1 - Math.pow(1 + r, -n)) / r;
  }

  /* Affordability: largest price satisfying GDS, TDS, down payment and insurance rules at the stress-test rate. */
  function affordability(o) {
    var qr = qualifyingRate(o.rate), inc = o.income / 12;
    var fixed = (o.propertyTax || 0) / 12 + (o.heat || 0) + (o.condoFees || 0) * 0.5;
    var maxHousingG = inc * (o.gdsLimit || R.debtLimits.gds) / 100 - fixed;
    var maxHousingT = inc * (o.tdsLimit || R.debtLimits.tds) / 100 - fixed - (o.debts || 0);
    var maxPmt = Math.max(0, Math.min(maxHousingG, maxHousingT));
    var limiting = maxHousingG <= maxHousingT ? 'GDS' : 'TDS';
    var down = o.down, best = { price: 0 };
    var lo = 0, hi = 20000000;
    for (var it = 0; it < 80; it++) {
      var mid = (lo + hi) / 2;
      var ok = feasible(mid);
      if (ok) { lo = mid; } else hi = mid;
    }
    function feasible(price) {
      if (down > price) return true;
      if (down + 0.005 < minDownPayment(price)) return false;
      var loan = price - down, ins = 0, years = o.years || 25;
      if (loan / price > 0.8) {
        var pr = insurancePremium({ price: price, down: down, amortization: years, firstTime: o.firstTime, newBuild: o.newBuild, province: o.province });
        if (!pr.eligible) return false; ins = pr.premium;
      }
      return monthlyPayment(loan + ins, qr, years) <= maxPmt;
    }
    var price = Math.floor(lo / 100) * 100;
    var loan = Math.max(0, price - down), prem = 0;
    if (price > 0 && loan / price > 0.8) prem = insurancePremium({ price: price, down: down, amortization: o.years || 25, firstTime: o.firstTime, newBuild: o.newBuild, province: o.province }).premium;
    return { maxPrice: price, qualifyingRate: qr, maxPayment: round2(maxPmt), limiting: limiting, loan: round2(loan + prem), premium: prem, contractPayment: round2(monthlyPayment(loan + prem, o.rate, o.years || 25)) };
  }

  /* Prepayment penalty. Variable: 3 months' interest. Fixed: greater of 3 months' interest and IRD. */
  function penalty(o) {
    var threeMonths = o.balance * (o.rate / 100) * 3 / 12;
    var res = { threeMonths: round2(threeMonths), ird: 0 };
    if (o.type === 'variable') { res.penalty = res.threeMonths; res.method = '3 months interest'; return res; }
    var cmp = o.compareRate;
    if (o.postedMethod) cmp = o.currentPosted - (o.originalPosted - o.rate);
    var diff = Math.max(0, o.rate - cmp);
    res.ird = round2(o.balance * diff / 100 * (o.monthsRemaining / 12));
    res.comparisonRate = round2(cmp);
    res.penalty = Math.max(res.threeMonths, res.ird);
    res.method = res.ird > res.threeMonths ? 'Interest rate differential' : '3 months interest';
    return res;
  }

  function renewal(o) {
    var oldP = monthlyPayment(o.balance, o.currentRate, o.remainingYears);
    var newP = monthlyPayment(o.balance, o.newRate, o.remainingYears);
    var termMonths = (o.termYears || 5) * 12;
    var a = schedule({ principal: o.balance, rate: o.currentRate, years: o.remainingYears, termYears: o.termYears || 5 });
    var b = schedule({ principal: o.balance, rate: o.newRate, years: o.remainingYears, termYears: o.termYears || 5 });
    return { oldPayment: round2(oldP), newPayment: round2(newP), change: round2(newP - oldP), changePct: round2((newP - oldP) / oldP * 100), termInterestOld: a.termInterest, termInterestNew: b.termInterest, termMonths: termMonths };
  }

  function refinance(o) {
    var maxLoan = o.homeValue * 0.8;
    var cashOut = Math.max(0, Math.min(o.newLoan, maxLoan) - o.balance - (o.penalty || 0) - (o.fees || 0));
    var newPmt = monthlyPayment(Math.min(o.newLoan, maxLoan), o.newRate, o.years);
    var oldPmt = monthlyPayment(o.balance, o.currentRate, o.remainingYears);
    var debtSaving = (o.consolidatedPayments || 0);
    var monthlySaving = oldPmt + debtSaving - newPmt;
    var cost = (o.penalty || 0) + (o.fees || 0);
    return { maxLoan: round2(maxLoan), cashOut: round2(cashOut), newPayment: round2(newPmt), oldPayment: round2(oldPmt), monthlySaving: round2(monthlySaving), breakEvenMonths: monthlySaving > 0 ? Math.ceil(cost / monthlySaving) : null };
  }

  /* Rent vs buy: net worth comparison after N years. */
  function rentVsBuy(o) {
    var years = o.years, price = o.price, down = o.down, loan = price - down;
    var ins = loan / price > 0.8 ? insurancePremium({ price: price, down: down, amortization: o.amortization || 25, province: o.province, firstTime: true }).premium : 0;
    var pmt = monthlyPayment(loan + ins, o.rate, o.amortization || 25);
    var sch = schedule({ principal: loan + ins, rate: o.rate, years: o.amortization || 25 });
    var bal = years * 12 >= sch.rows.length ? 0 : sch.rows[years * 12 - 1].balance;
    var home = price * Math.pow(1 + o.appreciation / 100, years);
    var sellCost = home * (o.sellingCostPct || 5) / 100;
    var ownerEquity = home - bal - sellCost;
    var mInv = Math.pow(1 + o.investReturn / 100, 1 / 12) - 1;
    var renterPortfolio = down + (o.closingCosts || 0);
    var rent = o.rent, ownerCostsTotal = 0, rentTotal = 0, ownerPortfolio = 0;
    for (var m = 1; m <= years * 12; m++) {
      var yr = Math.ceil(m / 12) - 1;
      var curHome = price * Math.pow(1 + o.appreciation / 100, yr);
      var ownMonthly = pmt + curHome * ((o.propertyTaxPct || 0.7) + (o.maintenancePct || 1)) / 100 / 12 + (o.ownerInsurance || 0);
      var rentMonthly = rent * Math.pow(1 + (o.rentIncrease || 2.5) / 100, yr) + (o.renterInsurance || 0);
      ownerCostsTotal += ownMonthly; rentTotal += rentMonthly;
      renterPortfolio *= (1 + mInv); ownerPortfolio *= (1 + mInv);
      var diff = ownMonthly - rentMonthly;
      if (diff > 0) renterPortfolio += diff; else ownerPortfolio += -diff;
    }
    return { monthlyPayment: round2(pmt), homeValue: round2(home), ownerNetWorth: round2(ownerEquity + ownerPortfolio), renterNetWorth: round2(renterPortfolio), ownerCosts: round2(ownerCostsTotal), rentPaid: round2(rentTotal), winner: ownerEquity + ownerPortfolio >= renterPortfolio ? 'Buy' : 'Rent' };
  }

  /* FHSA and HBP projection. */
  function fhsa(o) {
    var F = R.fhsa, bal = o.balance || 0, contributed = o.contributed || 0, years = o.years, carry = Math.min(o.carryForward || 0, F.carryMax), out = [];
    var taxSaved = 0;
    for (var y = 1; y <= years; y++) {
      var room = Math.max(0, Math.min(F.annual + carry, F.lifetime - contributed));
      var c = Math.max(0, Math.min(o.annualContribution, room));
      carry = Math.min(F.carryMax, Math.max(0, F.annual + carry - c));
      contributed += c;
      bal = (bal + c) * (1 + (o.returnPct || 0) / 100);
      taxSaved += c * (o.marginalRate || 0) / 100;
      out.push({ year: y, contribution: round2(c), contributed: round2(contributed), balance: round2(bal) });
    }
    return { rows: out, balance: round2(bal), contributed: round2(contributed), taxSaved: round2(taxSaved) };
  }

  function hbp(o) {
    var amt = Math.min(o.withdrawal, R.hbp.max);
    var people = o.couple ? 2 : 1;
    var perYear = round2(amt / R.hbp.repayYears);
    return { withdrawal: amt, householdMax: R.hbp.max * people, annualRepayment: perYear, repayYears: R.hbp.repayYears };
  }

  function downPaymentPlan(o) {
    var f = fhsa({ years: o.years, annualContribution: o.fhsaAnnual, returnPct: o.returnPct, marginalRate: o.marginalRate });
    var h = hbp({ withdrawal: o.rrsp || 0, couple: o.couple });
    var people = o.couple ? 2 : 1;
    return { fhsa: round2(f.balance * people), hbp: round2(h.withdrawal * people), cash: o.cash || 0, total: round2(f.balance * people + h.withdrawal * people + (o.cash || 0)), taxSaved: round2(f.taxSaved * people) };
  }

  function compareScenarios(list) {
    return list.map(function (s) {
      var down = s.down, loan = s.price - down;
      var ins = insurancePremium({ price: s.price, down: down, amortization: s.years, firstTime: s.firstTime, newBuild: s.newBuild, province: s.province });
      var total = loan + (ins.premium || 0);
      var sc = schedule({ principal: total, rate: s.rate, years: s.years, freq: s.freq || 'monthly', termYears: s.term || 5 });
      return { name: s.name, loan: round2(total), payment: sc.payment, premium: ins.premium, totalInterest: sc.totalInterest, years: sc.years, termBalance: sc.termBalance, qualifyingRate: qualifyingRate(s.rate) };
    });
  }

  var API = { round2: round2, clamp: clamp, periodicRate: periodicRate, FREQUENCIES: FREQUENCIES, annuityPayment: annuityPayment, monthlyPayment: monthlyPayment, payment: payment, schedule: schedule, yearly: yearly, toCSV: toCSV, qualifyingRate: qualifyingRate, minDownPayment: minDownPayment, maxAmortization: maxAmortization, insurancePremium: insurancePremium, bracketTax: bracketTax, landTransferTax: landTransferTax, closingCosts: closingCosts, fthbGstRebate: fthbGstRebate, debtRatios: debtRatios, maxLoanForPayment: maxLoanForPayment, affordability: affordability, penalty: penalty, renewal: renewal, refinance: refinance, rentVsBuy: rentVsBuy, fhsa: fhsa, hbp: hbp, downPaymentPlan: downPaymentPlan, compareScenarios: compareScenarios, RULES: R };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CMCS = API;
})(this);
