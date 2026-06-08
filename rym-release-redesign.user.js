// ==UserScript==
// @name         RYM Release Page Redesign
// @namespace    https://rateyourmusic.com/
// @version      2.0.0
// @description  Applies Refactoring UI principles to RYM album/release pages
// @author       Helena
// @match        https://rateyourmusic.com/release/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Set to true to print a selector audit to the DevTools console.
  const DEBUG = true;

  function addStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function stripCommas(el) {
    if (!el) { return; }
    Array.from(el.childNodes).forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        el.removeChild(node);
      }
    });
  }

  const PROBES = [
    'table.album_info',
    'th.info_hdr',
    'span.release_pri_genres',
    'span.release_pri_genres a.genre',
    'span.release_sec_genres',
    'span.release_sec_genres a.genre',
    'span.release_pri_descriptors',
    '.album_title',
    '.avg_rating',
    '.release_my_catalog',
    '.catalog_btn',
  ];

  function runDiagnostics() {
    PROBES.forEach(function (sel) {
      const n = document.querySelectorAll(sel).length;
      console.log('[RYM-redesign]', n ? '✓' : '✗ MISSING', sel, n ? '(' + n + ')' : '');
    });
  }

  // ─── CSS OVERRIDES ────────────────────────────────────────────────────────

  addStyle(`

    /* Type scale (Refactoring UI): 12 · 14 · 16 · 18 · 20 · 24 · 30 · 36 · 48 · 60 · 72 px */

    /* ── Genre chips ─────────────────────────────── */
    .release_pri_genres a.genre,
    .release_sec_genres a.genre {
      display: inline-block !important;
      padding: 3px 10px !important;
      border-radius: 20px !important;
      font-size: 12px !important;
      text-decoration: none !important;
      margin: 2px 3px 2px 0 !important;
    }
    .release_pri_genres a.genre {
      background: color-mix(in srgb, var(--gen-blue-dark, #2a5298) 12%, transparent) !important;
      color: var(--gen-blue-dark, #2a5298) !important;
      font-size: 16px !important;
      font-weight: 400 !important;
    }
    .release_sec_genres a.genre {
      background: var(--mono-f0, #f0f0f0) !important;
      font-size: 14px !important;
      color: var(--mono-6, #777) !important;
    }

    /* Secondary genres on their own line */
    .release_pri_genres + br { display: none !important; }
    .release_sec_genres { display: block !important; margin-top: 4px !important; }

    /* ── Descriptor text ─────────────────────────── */
    .release_pri_descriptors {
      font-size: 14px !important;
      color: var(--mono-7, #888) !important;
      line-height: 1.8 !important;
    }

  `);

  // ─── DOM MANIPULATION ─────────────────────────────────────────────────────

  // Renders each descriptor as its own span, with separator spans between
  // them. Each separator always renders ' · ' so its width is constant; we
  // only toggle visibility. A hidden separator still occupies its space, so
  // hiding it never reflows the line — keeping a single measurement pass
  // stable. Separators that fall at a line break are hidden, which removes
  // leading/trailing interpuncts. A ResizeObserver re-runs on column resize.
  function formatDescriptors(descEl) {
    const raw = descEl.textContent;
    const words = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    descEl.textContent = '';

    const spans = words.map(function (word, i) {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'rcb-sep';
        sep.textContent = ' · ';
        descEl.appendChild(sep);
      }
      const span = document.createElement('span');
      span.className = 'rcb-desc';
      span.textContent = word;
      descEl.appendChild(span);
      return span;
    });

    const seps = Array.from(descEl.querySelectorAll('.rcb-sep'));

    function updateSeparators() {
      for (let i = 0; i < spans.length - 1; i++) {
        const aRect = spans[i].getBoundingClientRect();
        const bRect = spans[i + 1].getBoundingClientRect();
        const sameLine = Math.abs((aRect.top + aRect.bottom) - (bRect.top + bRect.bottom)) < 4;
        seps[i].style.visibility = sameLine ? '' : 'hidden';
      }
    }

    requestAnimationFrame(updateSeparators);
    const target = descEl.closest('td') || descEl.parentElement;
    new ResizeObserver(function () { requestAnimationFrame(updateSeparators); }).observe(target);
  }

  function applyDomChanges() {
    if (DEBUG) { runDiagnostics(); }

    // Remove comma text nodes between genre chips so the pill layout is clean.
    stripCommas(document.querySelector('.release_pri_genres'));
    stripCommas(document.querySelector('.release_sec_genres'));

    // Reformat descriptor list with line-aware interpuncts.
    const descEl = document.querySelector('.release_pri_descriptors');
    if (descEl) { formatDescriptors(descEl); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDomChanges);
  } else {
    applyDomChanges();
  }

})();
