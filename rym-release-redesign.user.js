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

    /* ── Album info table ───────────────────────── */
    table.album_info,
    table.album_info td {
      font-size: 16px !important;
      color: #EBF5FE !important;
    }

    /* ── Descriptor text ─────────────────────────── */
    .release_pri_descriptors {
      font-size: 14px !important;
      color: #C4C9DA !important;
      line-height: 1.8 !important;
    }

  `);

  // ─── DOM MANIPULATION ─────────────────────────────────────────────────────

  // Applies margin-left: -10px (equal to chip padding-left) to every chip whose
  // natural left edge aligns with the container — i.e. the first chip on each
  // wrapped row. This makes the pill background overhang left while the label
  // text stays flush with the content column edge.
  // Measures after layout via rAF and compensates for any already-applied margin
  // so the ResizeObserver never triggers a feedback loop.
  // The container is set to display:flex + flex-wrap:wrap so each descriptor
  // wrapper is an indivisible flex item — it can never split across rows.
  // This makes position measurement reliable and keeps hidden separators
  // trailing within their own item (never leading into the next row).
  // Compares .top values: same row → within a few px; different row → ~line-height apart.
  // A ResizeObserver re-runs on column width changes.
  function alignFirstChipsPerRow(el) {
    if (!el) { return; }
    const chips = Array.from(el.querySelectorAll('a.genre'));

    function update() {
      requestAnimationFrame(function () {
        const containerLeft = el.getBoundingClientRect().left;
        chips.forEach(function (chip) {
          const chipLeft = chip.getBoundingClientRect().left;
          const appliedMargin = parseFloat(chip.style.getPropertyValue('margin-left')) || 0;
          const naturalLeft = chipLeft - appliedMargin;
          const isFirst = Math.abs(naturalLeft - containerLeft) < 4;
          if (isFirst) {
            chip.style.setProperty('margin-left', '-10px', 'important');
          } else {
            chip.style.removeProperty('margin-left');
          }
        });
      });
    }

    requestAnimationFrame(update);
    new ResizeObserver(function () { requestAnimationFrame(update); }).observe(el);
  }

  function formatDescriptors(descEl) {
    const raw = descEl.textContent;
    const words = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    descEl.textContent = '';
    descEl.style.cssText += '; display:flex !important; flex-wrap:wrap !important; align-items:baseline;';

    const wrappers = words.map(function (word, i) {
      const wrapper = document.createElement('span');
      wrapper.style.whiteSpace = 'nowrap';

      const desc = document.createElement('span');
      desc.className = 'rcb-desc';
      desc.textContent = word;
      wrapper.appendChild(desc);

      if (i < words.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'rcb-sep';
        sep.textContent = ' · ';
        wrapper.appendChild(sep);
      }

      descEl.appendChild(wrapper);
      return wrapper;
    });

    function updateSeparators() {
      for (let i = 0; i < wrappers.length - 1; i++) {
        const aTop = wrappers[i].getBoundingClientRect().top;
        const bTop = wrappers[i + 1].getBoundingClientRect().top;
        const sameLine = Math.abs(aTop - bTop) < 8;
        const sep = wrappers[i].querySelector('.rcb-sep');
        if (sep) { sep.style.visibility = sameLine ? '' : 'hidden'; }
      }
    }

    requestAnimationFrame(updateSeparators);
    new ResizeObserver(function () { requestAnimationFrame(updateSeparators); }).observe(descEl);
  }

  function applyDomChanges() {
    if (DEBUG) { runDiagnostics(); }

    // Remove comma text nodes between genre chips so the pill layout is clean.
    stripCommas(document.querySelector('.release_pri_genres'));
    stripCommas(document.querySelector('.release_sec_genres'));

    // Reformat descriptor list with line-aware interpuncts.
    alignFirstChipsPerRow(document.querySelector('.release_pri_genres'));
    alignFirstChipsPerRow(document.querySelector('.release_sec_genres'));
    const descEl = document.querySelector('.release_pri_descriptors');
    if (descEl) { formatDescriptors(descEl); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDomChanges);
  } else {
    applyDomChanges();
  }

})();
