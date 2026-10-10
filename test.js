/* Unit tests: node test.js */
'use strict';
var C = require('./calc.js');
var pass = 0, fail = 0;
function near(a, b, tol, name) { if (Math.abs(a - b) <= (tol == null ? 0.01 : tol)) pass++; else { fail++; console.log('FAIL', name, 'got', a, 'expected', b); } }
function ok(c, name) { if (c) pass++; else { fail++; console.log('FAIL', name); } }

// Stress test (OSFI)
near(C.qualifyingRate(4.29), 6.29, 1e-9, 'MQR contract+2');
near(C.qualifyingRate(2.99), 5.25, 1e-9, 'MQR floor');
near(C.qualifyingRate(3.25), 5.25, 1e-9, 'MQR equal');
near(C.qualifyingRate(0), 5.25, 1e-9, 'MQR zero');

// Semi-annual compounding
near(C.periodicRate(6, 2), 0.03, 1e-12, 'semi-annual');
near(C.periodicRate(6, 12), Math.pow(1.03, 1 / 6) - 1, 1e-12, 'monthly equiv');
near(C.periodicRate(0, 12), 0, 0, 'zero rate');
// $100k, 6%, 25y monthly: well-known Canadian figure $639.81
near(C.monthlyPayment(100000, 6, 25), 639.81, 0.01, 'payment 100k 6% 25y');
near(C.monthlyPayment(120000, 0, 10), 1000, 1e-9, 'zero-rate payment');
near(C.payment(400000, 5, 25, 'accBiweekly'), C.monthlyPayment(400000, 5, 25) / 2, 1e-9, 'acc biweekly');
near(C.payment(400000, 5, 25, 'accWeekly'), C.monthlyPayment(400000, 5, 25) / 4, 1e-9, 'acc weekly');
ok(C.payment(400000, 5, 25, 'biweekly') * 26 < C.monthlyPayment(400000, 5, 25) * 12 + 1, 'biweekly sums to about monthly');
ok(C.payment(400000, 5, 25, 'weekly') > 0, 'weekly');
ok(C.payment(400000, 5, 25, 'semimonthly') < C.monthlyPayment(400000, 5, 25), 'semimonthly');

// Schedules
var s = C.schedule({ principal: 100000, rate: 6, years: 25 });
ok(s.periods === 300, 'schedule length');
near(s.rows[s.rows.length - 1].balance, 0, 0.01, 'ends at zero');
near(s.rows[0].interest, 100000 * C.periodicRate(6, 12), 0.01, 'first interest');
near(s.totalInterest, 639.81 * 300 - 100000, 5, 'total interest');
var acc = C.schedule({ principal: 400000, rate: 5, years: 25, freq: 'accBiweekly' });
ok(acc.years < 22.5 && acc.years > 20, 'accelerated pays off early: ' + acc.years);
var lump = C.schedule({ principal: 400000, rate: 5, years: 25, annualLump: 10000 });
ok(lump.years < 18, 'lump sums shorten');
var ex = C.schedule({ principal: 400000, rate: 5, years: 25, extraPerPayment: 200 });
ok(ex.totalInterest < C.schedule({ principal: 400000, rate: 5, years: 25 }).totalInterest, 'extra saves interest');
ok(C.schedule({ principal: 100000, rate: 10, years: 25, payment: 100 }).error, 'payment below interest');
var t5 = C.schedule({ principal: 500000, rate: 4, years: 25, termYears: 5 });
ok(t5.termBalance > 400000 && t5.termBalance < 450000, 'term balance');
var y = C.yearly(s.rows);
ok(y.length === 25, 'yearly rows');
near(y.reduce(function (a, r) { return a + r.principal; }, 0), 100000, 0.5, 'yearly principal sums');
var csv = C.toCSV(s.rows.slice(0, 2));
ok(csv.split('\r\n').length === 3 && csv.indexOf('Balance') > 0, 'csv');

// Minimum down payment (FCAC examples)
near(C.minDownPayment(400000), 20000, 0, 'min down 400k');
near(C.minDownPayment(500000), 25000, 0, 'min down 500k');
near(C.minDownPayment(750000), 50000, 0, 'min down 750k (FCAC example $50,000)');
near(C.minDownPayment(1499999), 124999.9, 0.01, 'min down just under 1.5M');
near(C.minDownPayment(1500000), 300000, 0, 'min down at 1.5M');
near(C.minDownPayment(2000000), 400000, 0, 'min down 2M');

// Amortization limits
ok(C.maxAmortization(true, false, false) === 25, 'insured repeat 25');
ok(C.maxAmortization(true, true, false) === 30, 'insured FTB 30');
ok(C.maxAmortization(true, false, true) === 30, 'insured new build 30');
ok(C.maxAmortization(false) === 30, 'uninsured 30');

// Insurance premiums (CMHC tiers)
var p1 = C.insurancePremium({ price: 500000, down: 25000, amortization: 25, province: 'AB' });
near(p1.rate, 4.0, 0, '95% tier'); near(p1.premium, 19000, 0.01, 'premium 475k x 4%'); near(p1.pst, 0, 0, 'no PST AB');
var p2 = C.insurancePremium({ price: 600000, down: 60000, amortization: 25, province: 'ON' });
near(p2.premium, 16740, 0.01, '90% premium'); near(p2.pst, 1339.2, 0.01, 'ON PST 8%');
var p3 = C.insurancePremium({ price: 600000, down: 60000, amortization: 30, firstTime: true, province: 'QC' });
near(p3.rate, 3.3, 1e-9, '30yr surcharge'); near(p3.pst, p3.premium * 0.09, 0.01, 'QC PST 9%');
var p4 = C.insurancePremium({ price: 600000, down: 60000, amortization: 30, province: 'ON' });
ok(!p4.eligible, '30yr not allowed for repeat resale buyer');
ok(!C.insurancePremium({ price: 1500000, down: 150000 }).eligible, '1.5M cap');
ok(C.insurancePremium({ price: 1499000, down: 124900, amortization: 25 }).eligible, 'just under cap insurable');
ok(!C.insurancePremium({ price: 700000, down: 30000 }).eligible, 'below min down');
var p5 = C.insurancePremium({ price: 500000, down: 25000, nonTraditional: true });
near(p5.rate, 4.5, 0, 'non-traditional');
var p6 = C.insurancePremium({ price: 500000, down: 75000, province: 'SK' });
near(p6.rate, 2.8, 0, '85% tier'); near(p6.pst, p6.premium * 0.06, 0.01, 'SK PST 6%');
near(C.insurancePremium({ price: 500000, down: 50000 }).rate, 3.1, 0, '90% tier boundary');
near(C.insurancePremium({ price: 500000, down: 100000, forceInsure: true }).rate, 2.4, 0, '80% tier');
near(C.insurancePremium({ price: 500000, down: 125000, forceInsure: true }).rate, 1.7, 0, '75% tier');
near(C.insurancePremium({ price: 500000, down: 200000, forceInsure: true }).rate, 0.6, 0, '60% tier');
ok(!C.insurancePremium({ price: 500000, down: 100000 }).insured, '20% down not required');
near(C.insurancePremium({ price: 500000, down: 25000, eco: true }).ecoRefund, 4750, 0.01, 'eco refund 25%');

// Ontario LTT (ontario.ca examples)
near(C.landTransferTax({ province: 'ON', price: 500000 }).total, 6475, 0.01, 'ON 500k = $6,475');
near(C.landTransferTax({ province: 'ON', price: 368000 }).total, 3995, 0.01, 'ON 368k');
near(C.landTransferTax({ province: 'ON', price: 368000, firstTime: true }).total, 0, 0.01, 'ON FTB refund covers about 368k');
near(C.landTransferTax({ province: 'ON', price: 2500000 }).total, 36475 + 12500, 0.01, 'ON 2.5M');
near(C.landTransferTax({ province: 'ON', price: 300000, firstTime: true }).total, 0, 0.01, 'ON FTB under 368k zero');
// Toronto MLTT 2026
near(C.landTransferTax({ province: 'ON', price: 500000, toronto: true }).municipal, 6475, 0.01, 'TOR 500k');
near(C.landTransferTax({ province: 'ON', price: 400000, toronto: true, firstTime: true }).total, 475, 0.01, 'TOR FTB 400k: MLTT fully rebated, $475 provincial left');
near(C.landTransferTax({ province: 'ON', price: 3500000, toronto: true }).municipal, 36475 + 25000 + 22000, 0.01, 'TOR 3.5M luxury tier');
near(C.landTransferTax({ province: 'ON', price: 25000000, toronto: true }).municipal, 36475 + 25000 + 44000 + 54500 + 325000 + 755000 + 430000, 0.01, 'TOR 25M');
near(C.landTransferTax({ province: 'ON', price: 900000, toronto: true, firstTime: true }).rebate, 8475, 0.01, 'combined rebate');
// BC
near(C.landTransferTax({ province: 'BC', price: 500000 }).total, 8000, 0.01, 'BC 500k');
near(C.landTransferTax({ province: 'BC', price: 800000, firstTime: true }).total, 6000, 0.01, 'BC FTB 800k pays on portion over 500k');
near(C.landTransferTax({ province: 'BC', price: 860000, firstTime: true }).rebate, 0, 0.01, 'BC FTB phase end');
near(C.landTransferTax({ province: 'BC', price: 847500, firstTime: true }).rebate, 4000, 0.01, 'BC FTB mid phase');
near(C.landTransferTax({ province: 'BC', price: 1000000, newBuild: true }).total, 0, 0.01, 'BC new build');
near(C.landTransferTax({ province: 'BC', price: 1125000, newBuild: true }).rebate, 20500 / 2, 0.01, 'BC new build phase');
near(C.landTransferTax({ province: 'BC', price: 3500000 }).total, 2000 + 36000 + 30000 + 25000, 0.01, 'BC 3.5M');
// QC 2026
near(C.landTransferTax({ province: 'QC', price: 400000 }).total, 314.5 + 2521 + 1275, 0.01, 'QC 400k');
near(C.landTransferTax({ province: 'QC', price: 60000 }).total, 300, 0.01, 'QC first tranche');
near(C.landTransferTax({ province: 'QC', price: 600000, montreal: true }).total, 314.5 + 2521 + 3559.5 + 954, 0.01, 'MTL 600k');
// Others
near(C.landTransferTax({ province: 'MB', price: 300000 }).total, 300 + 600 + 750 + 2000, 0.01, 'MB 300k');
near(C.landTransferTax({ province: 'MB', price: 25000 }).total, 0, 0.01, 'MB under 30k');
near(C.landTransferTax({ province: 'SK', price: 406300 }).total, 1200, 0.01, 'SK title fee');
near(C.landTransferTax({ province: 'AB', price: 500000, loan: 400000 }).total, 50 + 500 + 50 + 400, 0.01, 'AB fees');
near(C.landTransferTax({ province: 'NB', price: 300000 }).total, 3000, 0.01, 'NB 1%');
near(C.landTransferTax({ province: 'NS', price: 400000 }).total, 6000, 0.01, 'Halifax 1.5%');
near(C.landTransferTax({ province: 'PE', price: 300000 }).total, 3000, 0.01, 'PEI 1%');
near(C.landTransferTax({ province: 'PE', price: 300000, firstTime: true }).total, 0, 0.01, 'PEI FTB');
near(C.landTransferTax({ province: 'NL', price: 300000 }).total, 100 + 1198, 0.01, 'NL');
['YT', 'NT', 'NU'].forEach(function (t) { var r = C.landTransferTax({ province: t, price: 400000 }); ok(r.total > 0 && r.total < 2000, t + ' fee'); });
// Bracket helper
near(C.bracketTax(0, [[100, 1]]), 0, 0, 'zero bracket');
near(C.bracketTax(200, [[100, 1], [Infinity, 2]]), 3, 1e-9, 'two brackets');

// Closing costs
var cc = C.closingCosts({ province: 'ON', price: 500000, insurancePst: 1000 });
near(cc.total, 6475 + 2000 + 500 + 350 + 350 + 1000 + 1500 + 1000, 0.01, 'closing total');
ok(C.closingCosts({ province: 'ON', price: 500000, newBuild: true, gstNet: 5000 }).items.length === 10, 'new build items');

// FTHB GST rebate (CRA example: $1.25M gives $25,000)
near(C.fthbGstRebate(1250000), 25000, 0.01, 'CRA example 1.25M');
near(C.fthbGstRebate(900000), 45000, 0.01, 'full GST 900k');
near(C.fthbGstRebate(1000000), 50000, 0.01, 'max 1M');
near(C.fthbGstRebate(1500000), 0, 0, 'zero at 1.5M');

// Debt ratios
var d = C.debtRatios({ income: 120000, loan: 500000, rate: 4, years: 25, propertyTax: 3600, heat: 100, debts: 500 });
near(d.qualifyingRate, 6, 1e-9, 'DR qualifying'); near(d.payment, C.monthlyPayment(500000, 6, 25), 0.01, 'DR payment');
near(d.gds, (d.payment + 300 + 100) / 10000 * 100, 0.01, 'GDS formula');
near(d.tds, d.gds + 5, 0.01, 'TDS formula');
var dc = C.debtRatios({ income: 100000, loan: 300000, rate: 4, years: 25, condoFees: 400 });
near(dc.gds, (dc.payment + 200) / (100000 / 12) * 100, 0.01, '50% condo fees');

// Affordability
var a = C.affordability({ income: 120000, rate: 4.5, down: 100000, years: 25, propertyTax: 4000, heat: 100 });
ok(a.maxPrice > 500000 && a.maxPrice < 700000, 'affordability range');
var chk = C.debtRatios({ income: 120000, loan: a.loan, rate: 4.5, years: 25, propertyTax: 4000, heat: 100 });
ok(chk.gds <= 39.01, 'affordability GDS holds');
ok(C.affordability({ income: 120000, rate: 4.5, down: 100000, years: 25, debts: 2000 }).limiting === 'TDS', 'TDS limit');
ok(C.affordability({ income: 1000000, rate: 4, down: 100000, years: 25 }).maxPrice < 1500000, 'insurance cap binds small down payment');
ok(C.affordability({ income: 1000000, rate: 4, down: 600000, years: 25 }).maxPrice > 2000000, 'large down');
near(C.maxLoanForPayment(639.81, 6, 25), 100000, 5, 'inverse payment');

// Penalty
var pv = C.penalty({ type: 'variable', balance: 400000, rate: 5 });
near(pv.penalty, 5000, 0.01, '3 months interest');
var pf = C.penalty({ type: 'fixed', balance: 400000, rate: 5, compareRate: 3.5, monthsRemaining: 36 });
near(pf.ird, 18000, 0.01, 'IRD'); ok(pf.method === 'Interest rate differential', 'IRD chosen');
var pp = C.penalty({ type: 'fixed', balance: 400000, rate: 5, postedMethod: true, originalPosted: 6.5, currentPosted: 5.5, monthsRemaining: 24 });
near(pp.comparisonRate, 4, 1e-9, 'posted method'); near(pp.ird, 8000, 0.01, 'posted IRD');
near(C.penalty({ type: 'fixed', balance: 400000, rate: 5, compareRate: 6, monthsRemaining: 24 }).penalty, 5000, 0.01, 'rates up: 3 months');

// Renewal / refinance
var rn = C.renewal({ balance: 400000, currentRate: 2, newRate: 4, remainingYears: 20, termYears: 5 });
ok(rn.change > 0 && rn.termInterestNew > rn.termInterestOld, 'renewal shock');
near(rn.newPayment, C.monthlyPayment(400000, 4, 20), 0.01, 'renewal payment');
var rf = C.refinance({ homeValue: 1000000, balance: 500000, newLoan: 900000, currentRate: 5, newRate: 4, remainingYears: 20, years: 25, penalty: 5000, fees: 1000 });
near(rf.maxLoan, 800000, 0, 'refi cap 80%'); near(rf.cashOut, 294000, 0.01, 'cash out');

// Rent vs buy
var rb = C.rentVsBuy({ price: 600000, down: 120000, rate: 4, amortization: 25, rent: 2500, years: 10, appreciation: 3, investReturn: 5 });
ok(rb.homeValue > 800000 && rb.homeValue < 810000, 'appreciation');
ok(rb.winner === 'Buy' || rb.winner === 'Rent', 'winner');
ok(C.rentVsBuy({ price: 600000, down: 120000, rate: 4, rent: 1000, years: 10, appreciation: 0, investReturn: 8 }).winner === 'Rent', 'cheap rent wins');

// FHSA / HBP
var f = C.fhsa({ years: 6, annualContribution: 8000, returnPct: 0 });
near(f.contributed, 40000, 0, 'FHSA lifetime cap'); ok(f.rows[5].contribution === 0, 'no room after 40k');
var f2 = C.fhsa({ years: 2, annualContribution: 16000, carryForward: 8000 });
near(f2.rows[0].contribution, 16000, 0, 'carry-forward used');
near(f2.rows[1].contribution, 8000, 0, 'carry exhausted');
near(C.fhsa({ years: 1, annualContribution: 8000, marginalRate: 30 }).taxSaved, 2400, 0, 'FHSA deduction');
near(C.hbp({ withdrawal: 75000 }).withdrawal, 60000, 0, 'HBP cap');
near(C.hbp({ withdrawal: 60000 }).annualRepayment, 4000, 0, 'HBP 15 years');
near(C.downPaymentPlan({ years: 5, fhsaAnnual: 8000, returnPct: 0, rrsp: 60000, couple: true, cash: 0 }).total, 200000, 0.01, 'couple plan');

// Scenarios
var sc = C.compareScenarios([{ name: 'A', price: 800000, down: 160000, rate: 4, years: 25 }, { name: 'B', price: 800000, down: 160000, rate: 4, years: 30 }]);
ok(sc[1].payment < sc[0].payment && sc[1].totalInterest > sc[0].totalInterest, 'longer amortization trade-off');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
