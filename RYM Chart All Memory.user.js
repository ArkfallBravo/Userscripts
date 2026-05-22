// ==UserScript==
// @name         RYM Chart :all Memory
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Saves :all / :-all modifier state when Update Chart is pressed, and re-applies it whenever a new chart is loaded (Library, Chart, etc.).
// @author       Helena S.
// @match        https://rateyourmusic.com/charts/*
// @match        http://rateyourmusic.com/charts/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rateyourmusic.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const LS_KEY = 'rym-chart-all-state';
  // ge must appear before g so the alternation matches the longer prefix first
  const FILTER_TYPES = ['ge', 'g', 'd', 's'];

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Read which filter types have :all / :-all in a chart URL. */
  function readState(url) {
    const state = {};
    for (const t of FILTER_TYPES) state[t] = { include: false, exclude: false };
    const re = new RegExp('/(' + FILTER_TYPES.join('|') + '):([^/?#]*)', 'g');
    let m;
    while ((m = re.exec(url)) !== null) {
      const parts = m[2].split(',');
      state[m[1]] = { include: parts.includes('all'), exclude: parts.includes('-all') };
    }
    return state;
  }

  /** Inject or strip :all / :-all in a chart URL based on saved state. */
  function applyState(url, state) {
    for (const t of FILTER_TYPES) {
      const ts = state[t];
      if (!ts) continue;
      const re = new RegExp('((?:^|/)' + t + ':)([^/?#]*)', 'g');
      url = url.replace(re, function (match, prefix, valuesStr) {
        const parts = valuesStr.split(',');
        const items = parts.filter(p => p !== 'all' && p !== '-all');
        // RYM encodes the leading - on excluded items as %2d
        const hasPos = items.some(p => p !== '' && !/^%2d/i.test(p));
        const hasNeg = items.some(p => /^%2d/i.test(p));
        const result = [];
        if (ts.include && hasPos) result.push('all');
        if (ts.exclude && hasNeg) result.push('-all');
        result.push(...items);
        return prefix + result.join(',');
      });
    }
    return url;
  }

  function saveState(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function loadState() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (_) { return {}; }
  }

  // ── Save state when Update Chart is pressed ────────────────────────────────
  let patchAttempts = 0;
  const patchInterval = setInterval(function () {
    if (++patchAttempts > 30) { clearInterval(patchInterval); return; }
    if (!window.RYMchart || typeof window.RYMchart.onClickCreateChart !== 'function') return;
    clearInterval(patchInterval);
    const orig = window.RYMchart.onClickCreateChart.bind(window.RYMchart);
    window.RYMchart.onClickCreateChart = function () {
      saveState(readState(window.location.href));
      return orig();
    };
  }, 200);

  // ── Apply saved state on any chart navigation (Library, Chart, etc.) ───────
  const origPushState = history.pushState.bind(history);
  history.pushState = function (stateObj, title, url) {
    if (typeof url === 'string' && /\/charts\//.test(url)) {
      url = applyState(url, loadState());
    }
    return origPushState(stateObj, title, url);
  };
})();
