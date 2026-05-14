// ==UserScript==
// @name         RYM Tracklist σ and 2σ-Trimmed Avg
// @namespace    rym-tools
// @version      1.0
// @description  Compute stdev per album and average excluding >2σ track outliers
// @match        https://rateyourmusic.com/*
// @match        https://sonemic.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // Helper: parse rating like "2.50 stars" from <img alt|title>
  function parseRating(img) {
    if (!img) return null;
    const txt = (img.getAttribute("alt") || img.getAttribute("title") || "").trim();
    const m = txt.match(/([\d.]+)\s*stars/i);
    return m ? parseFloat(m[1]) : null;
  }

  // Math helpers (sample standard deviation)
  function mean(vals) {
    if (!vals.length) return NaN;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function sampleStd(vals, mu) {
    const n = vals.length;
    if (n < 2) return 0;
    const varSum = vals.reduce((acc, x) => acc + Math.pow(x - mu, 2), 0) / (n - 1);
    return Math.sqrt(varSum);
  }

  function round2(x) {
    return Math.round(x * 100) / 100;
  }

  function processTable(tbl) {
    // Collect track rows with ratings
    const rows = Array.from(tbl.querySelectorAll("tbody > tr"));
    const ratingRows = rows.filter(r => r.querySelectorAll("td").length >= 3 && !r.querySelector("td[colspan]"));
    const ratings = [];

    for (const r of ratingRows) {
      const ratingCell = r.querySelectorAll("td")[2];
      if (!ratingCell) continue;
      const img = ratingCell.querySelector("img");
      const val = parseRating(img);
      if (typeof val === "number" && !Number.isNaN(val)) ratings.push(val);
    }

    if (ratings.length === 0) return;

    const mu = mean(ratings);
    const sd = sampleStd(ratings, mu);

    // Filter out > 2σ from mean (strictly greater than 2σ)
    const kept = ratings.filter(x => Math.abs(x - mu) <= 2 * sd);
    const trimmedAvg = kept.length ? mean(kept) : NaN;

    // Find the "Average:" row to append results next to it
    const avgRow = rows.find(r => /Average:/i.test(r.textContent));
    if (!avgRow) return;

    // Avoid duplicate injection
    if (avgRow.dataset.rymSigmaInjected === "1") return;
    avgRow.dataset.rymSigmaInjected = "1";

    // Build small inline readout
    const cell = avgRow.querySelector("td[colspan]") || avgRow.lastElementChild || avgRow;
    const span = document.createElement("span");
    span.style.marginLeft = "0.75em";
    span.style.color = "var(--mono-4)";
    span.style.fontWeight = "normal";
    span.title = `Tracks used: ${ratings.length}, Kept after 2σ: ${kept.length}`;

    const pieces = [];
    pieces.push(`σ: ${round2(sd)}`);
    if (!Number.isNaN(trimmedAvg)) pieces.push(`Trimmed avg (±2σ): ${round2(trimmedAvg)}`);
    span.textContent = `(${pieces.join(" • ")})`;

    cell.appendChild(span);
  }

  function run() {
    // Each album block contains a table.trackratings inside .or_q_review
    const tables = document.querySelectorAll(".or_q_review table.trackratings");
    tables.forEach(processTable);
  }

  // Run on load and on AJAX-y updates
  const ready = () => run();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }

  // Observe for dynamically added tracklists
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      for (const n of m.addedNodes || []) {
        if (!(n instanceof HTMLElement)) continue;
        if (n.matches && n.matches(".or_q_review table.trackratings")) processTable(n);
        n.querySelectorAll && n.querySelectorAll(".or_q_review table.trackratings").forEach(processTable);
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();