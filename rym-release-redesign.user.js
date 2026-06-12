// ==UserScript==
// @name         RYM Release Page Redesign
// @namespace    https://rateyourmusic.com/
// @version      2.0.0
// @description  Applies Refactoring UI principles to RYM album/release pages
// @author       Helena
// @match        https://rateyourmusic.com/release/*
// @run-at       document-end
// @require      file:///Users/lillyanasimson/Library/Mobile%20Documents/com~apple~CloudDocs/Personal-Coding-Projects/Personal%20Coding%20Projects/Userscripts/colour-scale.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Set to true to print a selector audit to the DevTools console.
  const DEBUG      = true;
  const purple       = 273.39430507048314;
  const blue         = 259.67189104481287;
  const red          = 22.524391836136154;
  const hue_dominant = purple;
  const hue_accent   = hue_dominant + 60;
  const curve        = 0;

  const grey      = makeUniformScale(hue_dominant, 5);
  const primary   = makeCurvedScale(hue_dominant, 85, curve);
  const secondary = makeCurvedScale(hue_dominant, 45, curve);
  const tertiary  = makeCurvedScale(hue_accent,   45, curve);

  const font_weight_thin       = 100;
  const font_weight_extralight = 200;
  const font_weight_light      = 300;
  const font_weight_normal     = 400;
  const font_weight_medium     = 500;
  const font_weight_semibold   = 600;
  const font_weight_bold       = 700;
  const font_weight_extrabold  = 800;
  const font_weight_black      = 900;

  const font_size_xs   = 12;
  const font_size_sm   = 14;
  const font_size_base = 16;
  const font_size_lg   = 18;
  const font_size_xl   = 20;
  const font_size_2xl  = 24;
  const font_size_3xl  = 30;
  const font_size_4xl  = 36;
  const font_size_5xl  = 48;
  const font_size_6xl  = 60;
  const font_size_7xl  = 72;



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
    '.album_title',
    'table.album_info a'
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

    // .section_main_info a {
    //   color: ${primary[200]} !important;
    // }

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
      border: 2px solid ${primary[200]} !important;
      // background: color-mix(in srgb, ${primary[400]} 25%, transparent) !important;
      color: ${primary[200]} !important;
      font-size: ${font_size_base}px !important;
      font-weight: ${font_weight_normal} !important;
    }
    .release_sec_genres a.genre {
      border: 1px solid ${grey[300]} !important;
      // background: color-mix(in srgb, ${grey[400]} 25%, transparent) !important;
      font-size: ${font_size_sm}px !important;
      color: ${grey[300]} !important;
      font-weight: ${font_weight_normal} !important;
    }
    .release_movement_genres a.genre {
      background: transparent !important;
      border: 0px solid ${primary[400]} !important;
      color: ${primary[200]} !important;
      font-size: ${font_size_base}px !important;
      font-weight: ${font_weight_normal} !important;
    }

    /* Secondary genres on their own line */
    .release_pri_genres + br { display: none !important; }
    .release_sec_genres { display: block !important; margin-top: 4px !important; }

    /* ── Album info table ───────────────────────── */
    th.info_hdr {
      font-size: ${font_size_sm}px !important;
      color: ${grey[400]} !important;
      font-weight: ${font_weight_normal} !important;
    }
    .album_title a {
      font-size: ${font_size_3xl}px !important;
      color: ${primary[50]} !important;
    }
    table.album_info,
    table.album_info td {
      font-size: ${font_size_base}px !important;
      color: ${grey[300]} !important;
    }
    table.album_info a {
      font-size: ${font_size_base}px !important;
      color: ${primary[200]} !important;
      font-weight: ${font_weight_normal} !important;
    }
    table.album_info b {
      font-size: ${font_size_base}px !important;
      color: ${grey[300]} !important;
      font-weight: ${font_weight_bold} !important;
    }
    .avg_rating {
      font-size: ${font_size_xl}px !important;
      font-weight: ${font_weight_bold} !important;
      color: ${grey[50]} !important;
    }
    .avg_rating_friends {
      font-size: ${font_size_base}px !important;
      color: ${tertiary[300]} !important;
      font-weight: ${font_weight_normal} !important;
    }
    .max_rating {
      font-size: ${font_size_base}px !important;
      color: ${grey[400]} !important;
    }
    .num_ratings {
      font-size: ${font_size_sm}px !important;
      color: ${grey[400]} !important;
    }
    tr.tr-released b {
      font-size: ${font_size_base}px !important;
      color: ${secondary[300]} !important;
      font-weight: ${font_weight_normal} !important;
    }
    tr.tr-ranking b {
      color: ${grey[100]} !important;
    }
    tr.tr-ranking td {
      color: ${grey[200]} !important;
    }

    /* ── Descriptor text ─────────────────────────── */
    .release_pri_descriptors {
      font-size: ${font_size_sm}px !important;
      color: ${grey[200]} !important;
      line-height: 1.8 !important;
    }

    /* —— genre and descriptor vote buttons ————————— */
    .genre_descriptor_vote_btn i.fa {
      color: ${grey[500]} !important;
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
  function tagInfoRows() {
    document.querySelectorAll('table.album_info tr').forEach(function (row) {
      var hdr = row.querySelector('th.info_hdr');
      if (!hdr) { return; }
      var label = hdr.textContent.trim();
      if (label === 'Released') { row.classList.add('tr-released'); }
    });
  }

  function tagmovementRows() {
    document.querySelectorAll('tr.release_genres').forEach(function (row) {
      var hdr = row.querySelector('th.info_hdr');
      if (!hdr || hdr.textContent.trim() === 'Genres') { return; }
      var priGenres = row.querySelector('.release_pri_genres');
      if (priGenres) { priGenres.classList.add('release_movement_genres'); }
    });
  }

  function alignFirstChipsPerRow(el) {
    if (!el) { return; }
    const chips = Array.from(el.querySelectorAll('a.genre'));

    function update() {
      requestAnimationFrame(function () {
        var naturals = chips.map(function (chip) {
          var margin = parseFloat(chip.style.getPropertyValue('margin-left')) || 0;
          return chip.getBoundingClientRect().left - margin;
        });
        var rowLeft = Math.min.apply(null, naturals);
        chips.forEach(function (chip, i) {
          var isFirst = naturals[i] - rowLeft < 4;
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

    tagInfoRows();
    tagmovementRows();

    // Remove comma text nodes between genre chips so the pill layout is clean.
    document.querySelectorAll('.release_pri_genres').forEach(function (el) {
      stripCommas(el);
      alignFirstChipsPerRow(el);
    });
    document.querySelectorAll('.release_sec_genres').forEach(function (el) {
      stripCommas(el);
      alignFirstChipsPerRow(el);
    });
    const descEl = document.querySelector('.release_pri_descriptors');
    if (descEl) { formatDescriptors(descEl); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDomChanges);
  } else {
    applyDomChanges();
  }

})();
