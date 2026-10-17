/* Canadian Mortgage Calculator Suite - interface. */
(function () {
  "use strict";
  var C = window.CMCS,
    R = window.CMCS_RULES;
  var PROV = [
    ["ON", "Ontario"],
    ["BC", "British Columbia"],
    ["AB", "Alberta"],
    ["QC", "Quebec"],
    ["MB", "Manitoba"],
    ["SK", "Saskatchewan"],
    ["NS", "Nova Scotia"],
    ["NB", "New Brunswick"],
    ["PE", "Prince Edward Island"],
    ["NL", "Newfoundland and Labrador"],
    ["YT", "Yukon"],
    ["NT", "Northwest Territories"],
    ["NU", "Nunavut"],
  ];
  var FREQ = Object.keys(C.FREQUENCIES).map(function (k) {
    return [k, C.FREQUENCIES[k].label];
  });
  var money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  var money2 = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  function $(s, el) {
    return (el || document).querySelector(s);
  }
  function m(x) {
    return money.format(x || 0);
  }
  function m2(x) {
    return money2.format(x || 0);
  }
  function pct(x) {
    return (Math.round(x * 100) / 100).toFixed(2) + "%";
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var state = { tab: "afford", v: {} };
  var lastCSV = null;

  function num(id, label, def, o) {
    return Object.assign({ id: id, label: label, type: "number", def: def }, o || {});
  }
  function chk(id, label, def) {
    return { id: id, label: label, type: "checkbox", def: !!def };
  }
  function sel(id, label, opts, def) {
    return { id: id, label: label, type: "select", opts: opts, def: def };
  }

  var TABS = [
    {
      id: "afford",
      name: "Affordability",
      intro: "How much home you can qualify for at the OSFI stress-test rate, with GDS and TDS shown.",
      fields: [
        num("income", "Household gross income per year", 140000, { step: 1000 }),
        num("down", "Down payment", 80000, { step: 1000 }),
        num("rate", "Contract rate (%)", 4.29, { step: 0.01 }),
        num("years", "Amortization (years)", 25, { min: 5, max: 30 }),
        num("debts", "Other monthly debt payments", 450),
        num("propertyTax", "Property tax per year", 4200),
        num("heat", "Heating per month", 120),
        num("condoFees", "Condo fees per month", 0),
        sel("province", "Province", PROV, "ON"),
        chk("firstTime", "First-time buyer"),
        chk("newBuild", "New build"),
      ],
      run: afford,
    },
    {
      id: "payment",
      name: "Payment",
      intro: "Payments for every frequency, including accelerated, with total interest and payoff time.",
      fields: [
        num("price", "Home price", 750000, { step: 1000 }),
        num("down", "Down payment", 75000, { step: 1000 }),
        num("rate", "Rate (%)", 4.29, { step: 0.01 }),
        num("years", "Amortization (years)", 25),
        sel("province", "Province", PROV, "ON"),
        chk("firstTime", "First-time buyer", true),
        chk("newBuild", "New build"),
      ],
      run: paymentTab,
    },
    {
      id: "ltt",
      name: "Land transfer tax",
      intro:
        "Provincial and municipal transfer tax for all 13 provinces and territories, with first-time buyer rebates.",
      fields: [
        num("price", "Purchase price", 850000, { step: 1000 }),
        sel("province", "Province or territory", PROV, "ON"),
        chk("toronto", "In the City of Toronto", true),
        chk("montreal", "In Montreal"),
        chk("firstTime", "First-time buyer", true),
        chk("newBuild", "Newly built home"),
      ],
      run: lttTab,
    },
    {
      id: "closing",
      name: "Closing costs",
      intro: "Cash you need on closing day on top of the down payment.",
      fields: [
        num("price", "Purchase price", 750000, { step: 1000 }),
        num("down", "Down payment", 75000, { step: 1000 }),
        sel("province", "Province", PROV, "ON"),
        chk("toronto", "In Toronto"),
        chk("firstTime", "First-time buyer", true),
        chk("newBuild", "New build (GST/HST)"),
        num("legal", "Legal fees", 2000),
        num("inspection", "Inspection", 500),
        num("appraisal", "Appraisal", 350),
        num("title", "Title insurance", 350),
        num("adjustments", "Tax and utility adjustments", 1000),
        num("moving", "Moving", 1500),
      ],
      run: closingTab,
    },
    {
      id: "cmhc",
      name: "Mortgage insurance",
      intro:
        "CMHC, Sagen and Canada Guaranty premiums share the same tiers. Includes the $1.5M cap, 30-year surcharge and PST.",
      fields: [
        num("price", "Home price", 700000, { step: 1000 }),
        num("down", "Down payment", 45000, { step: 1000 }),
        num("amortization", "Amortization (years)", 25),
        sel("province", "Province", PROV, "ON"),
        chk("firstTime", "First-time buyer"),
        chk("newBuild", "New build"),
        chk("nonTraditional", "Borrowed or non-traditional down payment"),
        chk("eco", "Energy-efficient home (eco refund)"),
      ],
      run: cmhcTab,
    },
    {
      id: "stress",
      name: "Stress test",
      intro: "Check one file against the minimum qualifying rate and the 39/44 debt limits.",
      fields: [
        num("income", "Gross income per year", 120000),
        num("loan", "Mortgage amount", 520000),
        num("rate", "Contract rate (%)", 4.29, { step: 0.01 }),
        num("years", "Amortization", 25),
        num("propertyTax", "Property tax per year", 4000),
        num("heat", "Heat per month", 100),
        num("condoFees", "Condo fees per month", 0),
        num("debts", "Other debt payments per month", 300),
      ],
      run: stressTab,
    },
    {
      id: "penalty",
      name: "Penalty",
      intro: "Estimate breaking a mortgage early: 3 months interest or the interest rate differential.",
      fields: [
        num("balance", "Balance owing", 480000),
        num("rate", "Your contract rate (%)", 5.39, { step: 0.01 }),
        sel(
          "type",
          "Rate type",
          [
            ["fixed", "Fixed"],
            ["variable", "Variable"],
          ],
          "fixed",
        ),
        num("monthsRemaining", "Months left in term", 30),
        num("compareRate", "Lender rate for remaining term (%)", 4.09, { step: 0.01 }),
        chk("postedMethod", "Big bank posted-rate method"),
        num("originalPosted", "Posted rate when you signed (%)", 6.49, { step: 0.01 }),
        num("currentPosted", "Current posted rate for remaining term (%)", 6.09, { step: 0.01 }),
      ],
      run: penaltyTab,
    },
    {
      id: "renew",
      name: "Renewal",
      intro: "See the payment shock at renewal and the interest over the new term.",
      fields: [
        num("balance", "Balance at renewal", 410000),
        num("currentRate", "Current rate (%)", 1.89, { step: 0.01 }),
        num("newRate", "Renewal rate (%)", 4.09, { step: 0.01 }),
        num("remainingYears", "Remaining amortization", 20),
        num("termYears", "New term (years)", 5),
      ],
      run: renewTab,
    },
    {
      id: "refi",
      name: "Refinance",
      intro: "Cash out up to 80% of value, or consolidate debt, with a break-even estimate.",
      fields: [
        num("homeValue", "Home value", 900000),
        num("balance", "Current balance", 450000),
        num("currentRate", "Current rate (%)", 5.19, { step: 0.01 }),
        num("remainingYears", "Remaining amortization", 21),
        num("newLoan", "New mortgage amount", 600000),
        num("newRate", "New rate (%)", 4.19, { step: 0.01 }),
        num("years", "New amortization", 30),
        num("penalty", "Penalty to break", 6000),
        num("fees", "Legal and appraisal", 1500),
        num("consolidatedPayments", "Monthly debt payments paid off", 900),
      ],
      run: refiTab,
    },
    {
      id: "amort",
      name: "Amortization",
      intro: "Full schedule with extra payments and annual lump sums. Download it as CSV.",
      fields: [
        num("principal", "Mortgage amount", 600000),
        num("rate", "Rate (%)", 4.29, { step: 0.01 }),
        num("years", "Amortization", 25),
        sel("freq", "Frequency", FREQ, "monthly"),
        num("extraPerPayment", "Extra per payment", 0),
        num("annualLump", "Annual lump sum", 0),
        num("termYears", "Term (years)", 5),
      ],
      run: amortTab,
    },
    {
      id: "rvb",
      name: "Rent vs buy",
      intro: "Net worth after a set number of years, investing whatever the cheaper option saves.",
      fields: [
        num("price", "Home price", 750000),
        num("down", "Down payment", 150000),
        num("rate", "Rate (%)", 4.29, { step: 0.01 }),
        num("amortization", "Amortization", 25),
        num("rent", "Monthly rent", 2900),
        num("years", "Years to compare", 10, { min: 1, max: 30 }),
        num("appreciation", "Home price growth (%/yr)", 3, { step: 0.1 }),
        num("rentIncrease", "Rent increase (%/yr)", 2.5, { step: 0.1 }),
        num("investReturn", "Investment return (%/yr)", 5, { step: 0.1 }),
        num("propertyTaxPct", "Property tax (% of value)", 0.7, { step: 0.05 }),
        num("maintenancePct", "Maintenance (% of value)", 1, { step: 0.1 }),
        num("closingCosts", "Closing costs", 25000),
        sel("province", "Province", PROV, "ON"),
      ],
      run: rvbTab,
    },
    {
      id: "fhsa",
      name: "FHSA + HBP",
      intro: "Build a down payment with the First Home Savings Account and the RRSP Home Buyers Plan.",
      fields: [
        num("years", "Years until purchase", 5, { min: 1, max: 15 }),
        num("fhsaAnnual", "FHSA contribution per year", 8000),
        num("returnPct", "Expected return (%/yr)", 4, { step: 0.1 }),
        num("marginalRate", "Marginal tax rate (%)", 31.48, { step: 0.01 }),
        num("rrsp", "RRSP withdrawal under HBP", 35000),
        num("cash", "Other savings", 10000),
        chk("couple", "Buying with a spouse or partner (double it)"),
      ],
      run: fhsaTab,
    },
    {
      id: "gst",
      name: "New home GST",
      intro: "The federal first-time home buyers GST/HST rebate on new builds (in force March 2026).",
      fields: [num("price", "New home price before tax", 900000), chk("firstTime", "First-time home buyer", true)],
      run: gstTab,
    },
    {
      id: "compare",
      name: "Compare",
      intro: "Up to three mortgages side by side.",
      fields: [
        num("price", "Home price", 800000),
        num("down", "Down payment", 80000),
        sel("province", "Province", PROV, "ON"),
        chk("firstTime", "First-time buyer", true),
        num("aRate", "A: rate (%)", 4.19, { step: 0.01 }),
        num("aYears", "A: amortization", 25),
        num("bRate", "B: rate (%)", 3.99, { step: 0.01 }),
        num("bYears", "B: amortization", 30),
        num("cRate", "C: rate (%)", 4.49, { step: 0.01 }),
        num("cYears", "C: amortization", 20),
      ],
      run: compareTab,
    },
    {
      id: "sources",
      name: "Sources",
      intro: "Every rule used here, the official source, and when it was last checked.",
      fields: [],
      run: sourcesTab,
    },
  ];

  function val(tab, f) {
    var v = state.v[tab.id] || {};
    return v[f.id] != null ? v[f.id] : f.def;
  }
  function values(tab) {
    var o = {};
    tab.fields.forEach(function (f) {
      o[f.id] = val(tab, f);
    });
    return o;
  }

  function renderTabs() {
    var nav = $("#tabs");
    nav.innerHTML = TABS.map(function (t) {
      return (
        '<button role="tab" id="tab-' +
        t.id +
        '" aria-controls="panel" aria-selected="' +
        (t.id === state.tab) +
        '" tabindex="' +
        (t.id === state.tab ? 0 : -1) +
        '" data-tab="' +
        t.id +
        '">' +
        esc(t.name) +
        "</button>"
      );
    }).join("");
  }

  function renderPanel() {
    var tab =
      TABS.filter(function (t) {
        return t.id === state.tab;
      })[0] || TABS[0];
    var form = tab.fields
      .map(function (f) {
        var v = val(tab, f),
          id = "f-" + f.id;
        if (f.type === "checkbox")
          return (
            '<label class="check"><input type="checkbox" id="' +
            id +
            '" data-f="' +
            f.id +
            '"' +
            (v ? " checked" : "") +
            "> " +
            esc(f.label) +
            "</label>"
          );
        if (f.type === "select")
          return (
            '<label for="' +
            id +
            '">' +
            esc(f.label) +
            '<select id="' +
            id +
            '" data-f="' +
            f.id +
            '">' +
            f.opts
              .map(function (o) {
                return '<option value="' + o[0] + '"' + (o[0] === v ? " selected" : "") + ">" + esc(o[1]) + "</option>";
              })
              .join("") +
            "</select></label>"
          );
        return (
          '<label for="' +
          id +
          '">' +
          esc(f.label) +
          '<input type="number" inputmode="decimal" id="' +
          id +
          '" data-f="' +
          f.id +
          '" value="' +
          v +
          '"' +
          (f.step ? ' step="' + f.step + '"' : "") +
          (f.min != null ? ' min="' + f.min + '"' : "") +
          (f.max != null ? ' max="' + f.max + '"' : "") +
          "></label>"
        );
      })
      .join("");
    var p = $("#panel");
    p.setAttribute("aria-labelledby", "tab-" + tab.id);
    p.innerHTML =
      '<div class="head"><h2>' +
      esc(tab.name) +
      "</h2><p>" +
      esc(tab.intro) +
      "</p></div>" +
      (form ? '<form class="grid" id="form" novalidate>' + form + "</form>" : "") +
      '<div id="out" class="out"></div>';
    compute();
  }

  function compute() {
    var tab = TABS.filter(function (t) {
      return t.id === state.tab;
    })[0];
    lastCSV = null;
    try {
      $("#out").innerHTML = tab.run(values(tab));
    } catch (e) {
      $("#out").innerHTML = '<p class="warn">Check the inputs: ' + esc(e.message) + "</p>";
    }
    var dl = $("#csvBtn");
    if (dl) dl.addEventListener("click", downloadCSV);
  }

  function kpi(label, value, cls) {
    return '<div class="kpi ' + (cls || "") + '"><span>' + esc(label) + "</span><strong>" + value + "</strong></div>";
  }
  function kpis(list) {
    return '<div class="kpis">' + list.join("") + "</div>";
  }
  function table(head, rows) {
    return (
      '<div class="tw"><table><thead><tr>' +
      head
        .map(function (h) {
          return '<th scope="col">' + esc(h) + "</th>";
        })
        .join("") +
      "</tr></thead><tbody>" +
      rows
        .map(function (r) {
          return (
            "<tr>" +
            r
              .map(function (c, i) {
                return i === 0 ? '<th scope="row">' + c + "</th>" : "<td>" + c + "</td>";
              })
              .join("") +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table></div>"
    );
  }
  function note(t) {
    return '<p class="note">' + t + "</p>";
  }
  function bar(parts) {
    var total =
      parts.reduce(function (s, p) {
        return s + Math.max(0, p[1]);
      }, 0) || 1;
    return (
      '<div class="bar" role="img" aria-label="' +
      esc(
        parts
          .map(function (p) {
            return p[0] + " " + m(p[1]);
          })
          .join(", "),
      ) +
      '">' +
      parts
        .map(function (p, i) {
          return (
            '<span class="c' + i + '" style="width:' + ((Math.max(0, p[1]) / total) * 100).toFixed(2) + '%"></span>'
          );
        })
        .join("") +
      '</div><ul class="legend">' +
      parts
        .map(function (p, i) {
          return '<li><i class="c' + i + '"></i>' + esc(p[0]) + ": " + m(p[1]) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }
  function lineChart(series, labels) {
    var W = 640,
      H = 220,
      pad = 34,
      max = 0,
      n = series[0].data.length;
    series.forEach(function (s) {
      s.data.forEach(function (d) {
        if (d > max) max = d;
      });
    });
    max = max || 1;
    function x(i) {
      return pad + (W - pad * 2) * (n <= 1 ? 0 : i / (n - 1));
    }
    function y(v) {
      return H - pad - ((H - pad * 2) * v) / max;
    }
    var paths = series
      .map(function (s, k) {
        return (
          '<path class="ln l' +
          k +
          '" d="' +
          s.data
            .map(function (d, i) {
              return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(d).toFixed(1);
            })
            .join(" ") +
          '"/>'
        );
      })
      .join("");
    var axis =
      '<line class="ax" x1="' +
      pad +
      '" y1="' +
      (H - pad) +
      '" x2="' +
      (W - pad) +
      '" y2="' +
      (H - pad) +
      '"/><text x="' +
      pad +
      '" y="' +
      (H - 10) +
      '">' +
      esc(labels[0]) +
      '</text><text x="' +
      (W - pad) +
      '" y="' +
      (H - 10) +
      '" text-anchor="end">' +
      esc(labels[1]) +
      '</text><text x="' +
      pad +
      '" y="20">' +
      m(max) +
      "</text>";
    return (
      '<figure class="chart"><svg viewBox="0 0 ' +
      W +
      " " +
      H +
      '" role="img" aria-label="' +
      esc(
        series
          .map(function (s) {
            return s.name;
          })
          .join(" and ") + " over time",
      ) +
      '">' +
      axis +
      paths +
      "</svg><figcaption>" +
      series
        .map(function (s, k) {
          return '<span><i class="l' + k + '"></i>' + esc(s.name) + "</span>";
        })
        .join("") +
      "</figcaption></figure>"
    );
  }

  function afford(v) {
    var a = C.affordability(v);
    var r = C.debtRatios({
      income: v.income,
      loan: a.loan,
      rate: v.rate,
      years: v.years,
      propertyTax: v.propertyTax,
      heat: v.heat,
      condoFees: v.condoFees,
      debts: v.debts,
    });
    var maxAm = C.maxAmortization(a.loan / Math.max(a.maxPrice, 1) > 0.8, v.firstTime, v.newBuild);
    var warn =
      v.years > maxAm
        ? '<p class="warn">An insured mortgage over 25 years needs a first-time buyer or a new build. Max here: ' +
          maxAm +
          " years.</p>"
        : "";
    return (
      warn +
      kpis([
        kpi("Maximum home price", m(a.maxPrice), "big"),
        kpi("Qualifying rate", pct(a.qualifyingRate)),
        kpi("Mortgage incl. insurance", m(a.loan)),
        kpi("Payment at contract rate", m2(a.contractPayment) + "/mo"),
        kpi("GDS", pct(r.gds) + " of 39%"),
        kpi("TDS", pct(r.tds) + " of 44%"),
      ]) +
      bar([
        ["Down payment", v.down],
        ["Mortgage", a.loan - a.premium],
        ["Insurance premium", a.premium],
      ]) +
      note(
        "Limited by " +
          a.limiting +
          ". Lenders test your payment at " +
          pct(a.qualifyingRate) +
          " (the greater of your rate plus 2% or 5.25%). Minimum down payment at this price: " +
          m(C.minDownPayment(a.maxPrice)) +
          ".",
      )
    );
  }

  function paymentTab(v) {
    var ins = C.insurancePremium({
      price: v.price,
      down: v.down,
      amortization: v.years,
      firstTime: v.firstTime,
      newBuild: v.newBuild,
      province: v.province,
    });
    if (!ins.eligible) return '<p class="warn">' + esc(ins.reasons.join(". ")) + ".</p>";
    var P = v.price - v.down + (ins.premium || 0);
    var rows = Object.keys(C.FREQUENCIES).map(function (k) {
      var s = C.schedule({ principal: P, rate: v.rate, years: v.years, freq: k });
      return [esc(C.FREQUENCIES[k].label), m2(s.payment), m(s.totalInterest), s.years.toFixed(1) + " yrs"];
    });
    return (
      kpis([
        kpi("Mortgage amount", m(P), "big"),
        kpi("Monthly payment", m2(C.payment(P, v.rate, v.years, "monthly"))),
        kpi("Insurance premium", m(ins.premium)),
        kpi("PST due at closing", m(ins.pst)),
      ]) +
      table(["Frequency", "Payment", "Total interest", "Paid off in"], rows) +
      note(
        "Rates compound semi-annually, as the Interest Act requires for fixed mortgages. Accelerated payments are the monthly payment divided by 2 or 4, which adds about one extra monthly payment per year.",
      )
    );
  }

  function lttTab(v) {
    var t = C.landTransferTax(v);
    var rows = [
      ["Provincial tax or fee", m2(t.provincial)],
      ["Municipal tax", m2(t.municipal)],
      ["First-time buyer rebate", "-" + m2(t.rebate)],
      ["<strong>Total payable</strong>", "<strong>" + m2(t.total) + "</strong>"],
    ];
    var all = PROV.map(function (p) {
      var x = C.landTransferTax({
        province: p[0],
        price: v.price,
        firstTime: v.firstTime,
        newBuild: v.newBuild,
        toronto: p[0] === "ON" && v.toronto,
        montreal: p[0] === "QC" && v.montreal,
        loan: v.price * 0.8,
      });
      return [esc(p[1]), m(x.total)];
    });
    return (
      kpis([kpi("Land transfer tax", m2(t.total), "big")]) +
      table(["Item", "Amount"], rows) +
      (t.notes.length ? note(esc(t.notes.join(". ")) + ".") : "") +
      "<h3>Same price in every province and territory</h3>" +
      table(["Province", "Total"], all)
    );
  }

  function closingTab(v) {
    var ins = C.insurancePremium({
      price: v.price,
      down: v.down,
      amortization: 25,
      firstTime: v.firstTime,
      newBuild: v.newBuild,
      province: v.province,
    });
    var gstNet = 0;
    if (v.newBuild) {
      var gst = v.price * 0.05;
      gstNet = Math.max(0, gst - (v.firstTime ? C.fthbGstRebate(v.price) : 0));
    }
    var c = C.closingCosts(
      Object.assign({}, v, { insurancePst: ins.pst || 0, gstNet: gstNet, loan: v.price - v.down }),
    );
    return (
      kpis([
        kpi("Closing costs", m(c.total), "big"),
        kpi("As % of price", pct((c.total / v.price) * 100)),
        kpi("Cash needed incl. down payment", m(c.total + v.down)),
      ]) +
      table(
        ["Item", "Amount"],
        c.items.map(function (i) {
          return [esc(i.k), m2(i.v)];
        }),
      ) +
      note(
        "A common rule of thumb is 1.5% to 4% of the price. GST on a new build is often already in the builder price; check your agreement.",
      )
    );
  }

  function cmhcTab(v) {
    var r = C.insurancePremium(v);
    var md = C.minDownPayment(v.price);
    if (!r.eligible)
      return (
        kpis([kpi("Minimum down payment", m(md), "big"), kpi("Loan-to-value", pct(r.ltv))]) +
        '<p class="warn">' +
        esc(r.reasons.join(". ")) +
        ".</p>"
      );
    var tiers = R.insurance.tiers.map(function (t, i) {
      var lo = i ? R.insurance.tiers[i - 1].maxLtv + 0.01 : 0;
      return [
        lo.toFixed(2) + "% to " + t.maxLtv + "%",
        t.rate.toFixed(2) + "%",
        (t.rate + R.insurance.surcharge30yr).toFixed(2) + "%",
      ];
    });
    return (
      kpis(
        [
          kpi("Premium", m2(r.premium), "big"),
          kpi("Premium rate", pct(r.rate)),
          kpi("Loan-to-value", pct(r.ltv)),
          kpi("Total insured mortgage", m(r.totalLoan || r.loan)),
          kpi("PST due at closing" + (r.pstRate ? " (" + r.pstRate + "%)" : ""), m2(r.pst)),
          kpi("Minimum down payment", m(md)),
        ].concat(r.ecoRefund ? [kpi("Possible eco refund (25%)", m(r.ecoRefund))] : []),
      ) +
      (r.insured ? "" : note(esc(r.reasons.join(". ")) + ".")) +
      "<h3>Premium tiers</h3>" +
      table(["Loan-to-value", "25 years or less", "Over 25 years"], tiers) +
      note(
        "Homes priced at $1.5 million or more cannot be insured. A 30-year insured amortization is open to first-time buyers and buyers of newly built homes since December 15, 2024.",
      )
    );
  }

  function stressTab(v) {
    var r = C.debtRatios(v),
      c = C.debtRatios(Object.assign({}, v, { qualify: false }));
    return (
      kpis([
        kpi("Result", r.pass ? "Passes" : "Does not pass", r.pass ? "good big" : "bad big"),
        kpi("Qualifying rate", pct(r.qualifyingRate)),
        kpi("Qualifying payment", m2(r.payment)),
        kpi("Actual payment", m2(c.payment)),
        kpi("GDS", pct(r.gds) + " / 39%", r.gds <= 39 ? "good" : "bad"),
        kpi("TDS", pct(r.tds) + " / 44%", r.tds <= 44 ? "good" : "bad"),
      ]) +
      note(
        "Uninsured borrowers switching lenders at renewal with no increase in loan or amortization do not need to requalify at this rate (OSFI, November 2024).",
      )
    );
  }

  function penaltyTab(v) {
    var r = C.penalty(v);
    return (
      kpis([
        kpi("Estimated penalty", m2(r.penalty), "big"),
        kpi("Method used", esc(r.method)),
        kpi("3 months interest", m2(r.threeMonths)),
        kpi("Interest rate differential", v.type === "fixed" ? m2(r.ird) : "n/a"),
      ]) +
      (v.type === "fixed"
        ? note(
            "Comparison rate used: " +
              pct(r.comparisonRate) +
              ". Banks that use posted rates subtract the discount you got from today's posted rate, which usually makes the penalty much larger. Your lender's statement is the final number.",
          )
        : "")
    );
  }

  function renewTab(v) {
    var r = C.renewal(v);
    return (
      kpis([
        kpi("New payment", m2(r.newPayment) + "/mo", "big"),
        kpi("Current payment", m2(r.oldPayment)),
        kpi(
          "Change",
          (r.change >= 0 ? "+" : "") + m2(r.change) + " (" + pct(r.changePct) + ")",
          r.change > 0 ? "bad" : "good",
        ),
        kpi("Interest over new term", m(r.termInterestNew)),
        kpi("Same term at old rate", m(r.termInterestOld)),
      ]) +
      note(
        "Switching lenders at renewal is a straight switch: no stress test for uninsured mortgages if the balance and amortization do not go up.",
      )
    );
  }

  function refiTab(v) {
    var r = C.refinance(v);
    return (
      kpis([
        kpi("Maximum refinance (80%)", m(r.maxLoan), "big"),
        kpi("Cash in hand", m(r.cashOut)),
        kpi("New payment", m2(r.newPayment)),
        kpi("Old mortgage + debts", m2(r.oldPayment + (v.consolidatedPayments || 0))),
        kpi("Monthly change", m2(r.monthlySaving), r.monthlySaving >= 0 ? "good" : "bad"),
        kpi("Break-even", r.breakEvenMonths ? r.breakEvenMonths + " months" : "n/a"),
      ]) + note("Refinances cannot be insured and are capped at 80% of the home value. They must pass the stress test.")
    );
  }

  function amortTab(v) {
    var s = C.schedule(v);
    if (s.error) return '<p class="warn">' + esc(s.error) + ".</p>";
    var base = C.schedule(Object.assign({}, v, { extraPerPayment: 0, annualLump: 0 }));
    var y = C.yearly(s.rows);
    lastCSV = C.toCSV(s.rows);
    return (
      kpis([
        kpi("Payment", m2(s.payment), "big"),
        kpi("Total interest", m(s.totalInterest)),
        kpi("Paid off in", s.years.toFixed(1) + " years"),
        kpi("Interest saved by prepaying", m(base.totalInterest - s.totalInterest), "good"),
        kpi("Balance at end of term", m(s.termBalance)),
      ]) +
      lineChart(
        [
          {
            name: "Balance",
            data: [v.principal].concat(
              y.map(function (r) {
                return r.balance;
              }),
            ),
          },
          {
            name: "Interest that year",
            data: [0].concat(
              y.map(function (r) {
                return r.interest;
              }),
            ),
          },
        ],
        ["Year 0", "Year " + y.length],
      ) +
      '<p><button type="button" class="primary" id="csvBtn">Download full schedule (CSV)</button></p>' +
      table(
        ["Year", "Principal", "Interest", "End balance"],
        y.map(function (r) {
          return [String(r.year), m(r.principal), m(r.interest), m(r.balance)];
        }),
      )
    );
  }

  function rvbTab(v) {
    var r = C.rentVsBuy(v);
    return (
      kpis([
        kpi("Better after " + v.years + " years", r.winner, "big"),
        kpi("Owner net worth", m(r.ownerNetWorth)),
        kpi("Renter net worth", m(r.renterNetWorth)),
        kpi("Mortgage payment", m2(r.monthlyPayment)),
        kpi("Home value then", m(r.homeValue)),
        kpi("Total rent paid", m(r.rentPaid)),
      ]) +
      note(
        "Owner net worth is home equity after a 5% selling cost plus any savings invested. The renter invests the down payment, closing costs and any monthly difference.",
      )
    );
  }

  function fhsaTab(v) {
    var f = C.fhsa({
      years: v.years,
      annualContribution: v.fhsaAnnual,
      returnPct: v.returnPct,
      marginalRate: v.marginalRate,
    });
    var d = C.downPaymentPlan(v);
    return (
      kpis([
        kpi("Down payment available", m(d.total), "big"),
        kpi("FHSA balance", m(d.fhsa)),
        kpi("HBP withdrawal", m(d.hbp)),
        kpi("Tax refunds from FHSA", m(d.taxSaved), "good"),
        kpi("HBP repayment per year", m((Math.min(v.rrsp, R.hbp.max) / R.hbp.repayYears) * (v.couple ? 2 : 1))),
      ]) +
      table(
        ["Year", "Contribution", "Total contributed", "Balance"],
        f.rows.map(function (r) {
          return [String(r.year), m(r.contribution), m(r.contributed), m(r.balance)];
        }),
      ) +
      note(
        "FHSA: $8,000 a year, $40,000 lifetime, up to $8,000 of unused room carries forward. HBP: up to $60,000 per person from your RRSP, repaid over 15 years.",
      )
    );
  }

  function gstTab(v) {
    var gst = v.price * 0.05,
      reb = v.firstTime ? C.fthbGstRebate(v.price) : 0;
    return (
      kpis([
        kpi("First-time buyer GST rebate", m(reb), "big"),
        kpi("GST at 5%", m(gst)),
        kpi("Net GST", m(gst - reb)),
      ]) +
      note(
        "Full rebate up to $50,000 on new homes up to $1 million, reduced in a straight line to zero at $1.5 million. Applies to agreements signed from March 20, 2025 and before 2031. In HST provinces it covers the federal 5% part only.",
      )
    );
  }

  function compareTab(v) {
    var list = [
      ["A", v.aRate, v.aYears],
      ["B", v.bRate, v.bYears],
      ["C", v.cRate, v.cYears],
    ].map(function (x) {
      return {
        name: "Option " + x[0],
        price: v.price,
        down: v.down,
        rate: x[1],
        years: x[2],
        province: v.province,
        firstTime: v.firstTime,
        term: 5,
      };
    });
    var r = C.compareScenarios(list);
    var best = r.reduce(function (b, x) {
      return x.totalInterest < b.totalInterest ? x : b;
    }, r[0]);
    return table(
      [
        "Option",
        "Mortgage",
        "Monthly payment",
        "Insurance",
        "Total interest",
        "Balance after 5 yrs",
        "Qualifying rate",
      ],
      r.map(function (x) {
        return [
          esc(x.name) + (x === best ? ' <span class="tag">least interest</span>' : ""),
          m(x.loan),
          m2(x.payment),
          m(x.premium),
          m(x.totalInterest),
          m(x.termBalance),
          pct(x.qualifyingRate),
        ];
      }),
    );
  }

  function sourcesTab() {
    return (
      '<div class="sources">' +
      window.CMCS_SOURCES.map(function (s) {
        return (
          "<article><h3>" +
          esc(s.topic) +
          "</h3><p>" +
          esc(s.rule) +
          "</p>" +
          (s.change ? '<p class="chg">Recent change: ' + esc(s.change) + "</p>" : "") +
          '<p class="src"><a href="' +
          s.url +
          '" target="_blank" rel="noopener">' +
          esc(s.src) +
          "</a> <span>Checked " +
          s.asOf +
          "</span></p></article>"
        );
      }).join("") +
      "</div>"
    );
  }

  function downloadCSV() {
    if (!lastCSV) return;
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lastCSV], { type: "text/csv" }));
    a.download = "amortization-schedule.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function encodeState() {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    } catch (e) {
      return "";
    }
  }
  function loadState() {
    var h = location.hash.slice(1);
    if (h.indexOf("s=") === 0) {
      try {
        var s = JSON.parse(decodeURIComponent(escape(atob(h.slice(2)))));
        if (s && s.tab) state = s;
      } catch (e) {}
    } else if (
      h &&
      TABS.some(function (t) {
        return t.id === h;
      })
    )
      state.tab = h;
  }
  function toast(t) {
    var el = $("#toast");
    el.textContent = t;
    el.classList.add("on");
    setTimeout(function () {
      el.classList.remove("on");
    }, 2200);
  }

  function bind() {
    $("#tabs").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-tab]");
      if (!b) return;
      state.tab = b.dataset.tab;
      history.replaceState(null, "", "#" + state.tab);
      renderTabs();
      renderPanel();
    });
    $("#tabs").addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var i = TABS.findIndex(function (t) {
        return t.id === state.tab;
      });
      i = (i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
      state.tab = TABS[i].id;
      renderTabs();
      renderPanel();
      $("#tab-" + state.tab).focus();
    });
    $("#panel").addEventListener("input", function (e) {
      var f = e.target.dataset.f;
      if (!f) return;
      var v = state.v[state.tab] || (state.v[state.tab] = {});
      v[f] =
        e.target.type === "checkbox"
          ? e.target.checked
          : e.target.type === "number"
            ? e.target.value === ""
              ? 0
              : parseFloat(e.target.value)
            : e.target.value;
      compute();
    });
    $("#shareBtn").addEventListener("click", function () {
      var url = location.origin + location.pathname + "#s=" + encodeState();
      history.replaceState(null, "", url);
      if (navigator.clipboard)
        navigator.clipboard.writeText(url).then(
          function () {
            toast("Link copied");
          },
          function () {
            toast("Link is in the address bar");
          },
        );
      else toast("Link is in the address bar");
    });
    $("#pdfBtn").addEventListener("click", function () {
      document.title = "Mortgage report - " + new Date().toISOString().slice(0, 10);
      window.print();
    });
    $("#themeBtn").addEventListener("click", function () {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
  }
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    $("#themeBtn").setAttribute("aria-pressed", String(t === "dark"));
    $("#themeBtn").textContent = t === "dark" ? "Light mode" : "Dark mode";
    try {
      localStorage.setItem("cmcs-theme", t);
    } catch (e) {}
  }

  loadState();
  var saved = null;
  try {
    saved = localStorage.getItem("cmcs-theme");
  } catch (e) {}
  setTheme(saved || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  $("#asof").textContent = R.asOf;
  renderTabs();
  renderPanel();
  bind();
})();
