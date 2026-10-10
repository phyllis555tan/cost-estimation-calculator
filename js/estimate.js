(function () {
  var TIERS = ["Basic", "Standard", "Premium"];
  var DEFAULT_RATES = window.ODD_DEFAULT_RATES;

  var rates = JSON.parse(JSON.stringify(DEFAULT_RATES));
  var tier = 1;
  var lines = [{ room: "", item: "tile", qty: "" }];
  var realRates = false;

  // saved settings (the page still works if storage is blocked)
  try {
    var saved = JSON.parse(localStorage.getItem("odd_rates") || "null");
    if (saved && saved.length === DEFAULT_RATES.length) rates = saved;
    realRates = localStorage.getItem("odd_real") === "1";
    var t = localStorage.getItem("odd_tier");
    if (t !== null) tier = Number(t);
  } catch (e) {}

  function save() {
    try {
      localStorage.setItem("odd_rates", JSON.stringify(rates));
      localStorage.setItem("odd_tier", String(tier));
      localStorage.setItem("odd_real", realRates ? "1" : "0");
    } catch (e) {}
  }
  function $(id) { return document.getElementById(id); }
  function rm(n) { return "RM " + Math.round(n).toLocaleString("en-MY"); }
  function rateOf(id) { return rates.filter(function (r) { return r.id === id; })[0]; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  function renderTiers() {
    $("tiers").innerHTML = TIERS.map(function (n, i) {
      return '<button type="button" class="tier' + (i === tier ? " on" : "") + '" data-t="' + i + '">' + n + "</button>";
    }).join("");
    Array.prototype.forEach.call($("tiers").children, function (b) {
      b.onclick = function () { tier = Number(b.getAttribute("data-t")); save(); renderTiers(); renderLines(); calc(); };
    });
  }

  function renderLines() {
    $("lines").innerHTML = lines.map(function (l, i) {
      var r = rateOf(l.item);
      var opts = rates.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === l.item ? " selected" : "") + ">" + esc(x.name) + "</option>";
      }).join("");
      var amt = (Number(l.qty) || 0) * r.r[tier];
      return '<div class="line" data-i="' + i + '">' +
        '<div><label>Room</label><input data-f="room" type="text" value="' + esc(l.room) + '" placeholder="e.g. Living room"></div>' +
        '<div class="wide"><label>Work</label><select data-f="item">' + opts + "</select></div>" +
        '<div><label>Quantity</label><input data-f="qty" type="number" min="0" step="any" value="' + esc(l.qty) + '"></div>' +
        '<div class="unit">' + esc(r.unit) + " @ " + rm(r.r[tier]) + "</div>" +
        '<div class="amt" data-amt>' + rm(amt) + "</div>" +
        '<button class="rm noprint" data-del title="Remove this line">&times;</button></div>';
    }).join("");
    Array.prototype.forEach.call($("lines").querySelectorAll(".line"), function (row) {
      var i = Number(row.getAttribute("data-i"));
      Array.prototype.forEach.call(row.querySelectorAll("[data-f]"), function (inp) {
        inp.oninput = inp.onchange = function () {
          lines[i][inp.getAttribute("data-f")] = inp.value;
          if (inp.getAttribute("data-f") === "item") { renderLines(); }
          else { var r = rateOf(lines[i].item); row.querySelector("[data-amt]").textContent = rm((Number(lines[i].qty) || 0) * r.r[tier]); }
          calc();
        };
      });
      row.querySelector("[data-del]").onclick = function () {
        lines.splice(i, 1);
        if (!lines.length) lines.push({ room: "", item: "tile", qty: "" });
        renderLines(); calc();
      };
    });
  }

  function renderRates() {
    var h = "<tr><th>Work</th><th>Unit</th>" + TIERS.map(function (t) { return "<th>" + t + " (RM)</th>"; }).join("") + "</tr>";
    h += rates.map(function (r, ri) {
      return "<tr><td>" + esc(r.name) + "</td><td>" + esc(r.unit) + "</td>" +
        r.r.map(function (v, ti) { return '<td><input type="number" min="0" step="any" data-r="' + ri + '" data-t="' + ti + '" value="' + v + '"></td>'; }).join("") + "</tr>";
    }).join("");
    $("rateTable").innerHTML = h;
    Array.prototype.forEach.call($("rateTable").querySelectorAll("input"), function (inp) {
      inp.oninput = function () {
        rates[Number(inp.getAttribute("data-r"))].r[Number(inp.getAttribute("data-t"))] = Number(inp.value) || 0;
        save(); renderLines(); calc();
      };
    });
  }

  function calc() {
    var byRoom = {}, order = [], sub = 0;
    lines.forEach(function (l) {
      var q = Number(l.qty) || 0;
      if (!q) return;
      var amt = q * rateOf(l.item).r[tier];
      var room = l.room.trim() || "Unnamed room";
      if (!(room in byRoom)) { byRoom[room] = 0; order.push(room); }
      byRoom[room] += amt;
      sub += amt;
    });
    var cont = Math.max(0, Number($("cont").value) || 0);
    var contAmt = sub * cont / 100;
    var total = sub + contAmt;
    $("roomTable").innerHTML = "<tr><th>Room</th><th>Amount</th></tr>" +
      (order.length ? order.map(function (r) { return "<tr><td>" + esc(r) + "</td><td>" + rm(byRoom[r]) + "</td></tr>"; }).join("")
                    : '<tr><td colspan="2" style="color:#6b665c">Add quantities above to see the rooms here.</td></tr>');
    $("sub").textContent = rm(sub);
    $("contAmt").textContent = rm(contAmt);
    $("total").textContent = rm(total);
    $("range").textContent = rm(total * 0.9) + " to " + rm(total * 1.1);

    var budget = Number($("budget").value) || 0;
    var s = $("status");
    if (budget && total > 0) {
      var diff = budget - total;
      if (diff >= 0) { s.className = "status ok"; s.textContent = "Within the client's budget, with " + rm(diff) + " to spare."; }
      else { s.className = "status bad"; s.textContent = "Over the client's budget by " + rm(-diff) + ". Look at lowering the finish level or trimming the scope."; }
    } else { s.className = ""; s.textContent = ""; }

    var meta = [];
    if ($("client").value) meta.push("Client: " + $("client").value);
    if ($("project").value) meta.push("Project: " + $("project").value);
    meta.push("Finish level: " + TIERS[tier]);
    meta.push("Date: " + new Date().toLocaleDateString("en-MY"));
    if (!realRates) meta.push("DRAFT: starter rates, not final prices");
    $("printMeta").textContent = meta.join("  |  ");
    $("starterBanner").style.display = realRates ? "none" : "block";
    $("realRates").checked = realRates;
  }

  $("add").onclick = function () { lines.push({ room: "", item: "tile", qty: "" }); renderLines(); };
  ["client", "project", "budget", "cont"].forEach(function (id) { $(id).oninput = calc; });
  $("print").onclick = function () { window.print(); };
  $("realRates").onchange = function () { realRates = $("realRates").checked; save(); calc(); };
  $("resetRates").onclick = function () {
    rates = JSON.parse(JSON.stringify(DEFAULT_RATES)); save(); renderRates(); renderLines(); calc();
  };
  $("csv").onclick = function () {
    function q(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }
    var rows = [["Room", "Work", "Unit", "Quantity", "Rate (RM)", "Amount (RM)"]];
    var sub = 0;
    lines.forEach(function (l) {
      var n = Number(l.qty) || 0; if (!n) return;
      var r = rateOf(l.item), a = n * r.r[tier]; sub += a;
      rows.push([l.room || "Unnamed room", r.name, r.unit, n, r.r[tier], a]);
    });
    var cont = Math.max(0, Number($("cont").value) || 0);
    rows.push([]);
    rows.push(["", "Subtotal", "", "", "", sub]);
    rows.push(["", "Contingency " + cont + "%", "", "", "", sub * cont / 100]);
    rows.push(["", "Estimated total (" + TIERS[tier] + ")", "", "", "", sub * (1 + cont / 100)]);
    var csv = rows.map(function (r) { return r.map(q).join(","); }).join("\r\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ODD-STUDIO-estimate" + ($("client").value ? "-" + $("client").value.replace(/\W+/g, "-") : "") + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  renderTiers(); renderLines(); renderRates(); calc();

  // Small API used by js/cloud.js to save and restore a project and the rate table.
  window.ODD_EST = {
    getProject: function () {
      return { client: $("client").value, project: $("project").value, budget: $("budget").value, cont: $("cont").value, tier: tier, lines: JSON.parse(JSON.stringify(lines)) };
    },
    setProject: function (p) {
      p = p || {};
      $("client").value = p.client || ""; $("project").value = p.project || ""; $("budget").value = p.budget || ""; $("cont").value = p.cont == null ? 10 : p.cont;
      if (p.tier === 0 || p.tier === 1 || p.tier === 2) tier = p.tier;
      lines = (Array.isArray(p.lines) && p.lines.length ? p.lines : [{ room: "", item: "tile", qty: "" }]).filter(function (l) { return rateOf(l.item); });
      if (!lines.length) lines = [{ room: "", item: "tile", qty: "" }];
      save(); renderTiers(); renderLines(); calc();
    },
    getRates: function () { return { rates: JSON.parse(JSON.stringify(rates)), real: realRates }; },
    setRates: function (r, real) {
      var ok = Array.isArray(r) && r.length === DEFAULT_RATES.length && r.every(function (x, i) {
        return x && x.id === DEFAULT_RATES[i].id && Array.isArray(x.r) && x.r.length === 3 && x.r.every(function (n) { return typeof n === "number" && n >= 0; });
      });
      if (!ok) return false;
      rates = JSON.parse(JSON.stringify(r)); realRates = !!real; save(); renderRates(); renderLines(); calc(); return true;
    }
  };
})();
