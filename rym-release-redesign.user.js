// ==UserScript==
// @name         RYM Release Page Redesign
// @namespace    https://rateyourmusic.com/
// @version      1.1.0
// @description  Applies Refactoring UI principles to RYM album/release pages
// @author       Helena
// @match        https://rateyourmusic.com/release/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Set to true to print a selector audit to the DevTools console.
  // Each line shows ✓ (matched) or ✗ MISSING (zero elements found).
  // Use the MISSING lines to find the real class names and fix the
  // UNCONFIRMED rules below.
  const DEBUG = true;

  function addStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  // Selectors to probe when DEBUG is on.
  // Confirmed = verified against RYM Release Chart Button.user.js.
  // Unconfirmed = best guess; may need correction.
  const PROBES = [
    /* confirmed */
    'table.album_info',
    'th.info_hdr',
    'span.release_pri_genres',
    'span.release_pri_genres a.genre',
    'span.release_sec_genres',
    'span.release_sec_genres a.genre',
    'span.release_pri_descriptors',
    /* unconfirmed */
    '.album_title',
    '.avg_rating',
    '.max_rating',
    '.num_ratings',
    'ul.tracklisting',
    'ul.tracklisting li:first-child',
    '.release_my_catalog',
    '.catalog_btn',
    'table.color_bar',
    '.album_shortcut',
    'a.artist',
  ];

  function runDiagnostics() {
    PROBES.forEach(function (sel) {
      const n = document.querySelectorAll(sel).length;
      console.log('[RYM-redesign]', n ? '✓' : '✗ MISSING', sel, n ? '(' + n + ')' : '');
    });
  }

  // ─── CSS OVERRIDES ────────────────────────────────────────────────────────

  addStyle(`

    /* ── Album title ─────────────────────────────── */
    /* UNCONFIRMED: .album_title */
    .album_title {
      font-size: 28px !important;
      font-weight: 800 !important;
      letter-spacing: -0.5px !important;
      line-height: 1.15 !important;
      margin-bottom: 8px !important;
    }

    /* ── Info table: mute labels, remove grid borders ── */
    /* CONFIRMED: table.album_info, th.info_hdr */
    table.album_info {
      border-collapse: collapse !important;
    }
    table.album_info tr {
      border-bottom: 1px solid var(--mono-e, #ebebeb) !important;
    }
    table.album_info tr:last-child {
      border-bottom: none !important;
    }
    table.album_info td,
    table.album_info th {
      padding: 8px 10px 8px 0 !important;
      border: none !important;
    }
    th.info_hdr {
      font-size: 10px !important;
      text-transform: uppercase !important;
      letter-spacing: 0.1em !important;
      font-weight: 700 !important;
      color: var(--mono-8, #999) !important;
      vertical-align: top !important;
      padding-top: 10px !important;
      white-space: nowrap !important;
    }

    /* ── Rating: make the score the hero ─────────── */
    /* UNCONFIRMED: .avg_rating, .max_rating, .num_ratings */
    .avg_rating {
      font-size: 32px !important;
      font-weight: 800 !important;
      line-height: 1 !important;
      color: var(--mono-1, #111) !important;
      vertical-align: baseline !important;
    }
    .max_rating {
      font-size: 15px !important;
      color: var(--mono-9, #aaa) !important;
      vertical-align: baseline !important;
      margin-left: 2px !important;
    }
    .num_ratings {
      display: block !important;
      font-size: 11px !important;
      color: var(--mono-8, #aaa) !important;
      margin-top: 4px !important;
      font-weight: normal !important;
    }
    .num_ratings b {
      font-weight: 600 !important;
    }

    /* ── Genre chips ─────────────────────────────── */
    /* CONFIRMED: .release_pri_genres a.genre, .release_sec_genres a.genre */
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
      font-weight: 600 !important;
    }
    .release_sec_genres a.genre {
      background: var(--mono-f0, #f0f0f0) !important;
      color: var(--mono-6, #777) !important;
    }
    /* Remove the <br> gap between primary and secondary genres */
    .release_pri_genres + br { display: none !important; }

    /* ── Descriptor text: smaller and muted ─────── */
    /* CONFIRMED: .release_pri_descriptors */
    .release_pri_descriptors {
      font-size: 11.5px !important;
      color: var(--mono-7, #888) !important;
      line-height: 1.8 !important;
    }

    /* ── Track listing ───────────────────────────── */
    /* UNCONFIRMED: ul.tracklisting, li.track, .tracklist_line, */
    /* .tracklist_num, .tracklist_title, .tracklist_duration, .tracklist_total */
    ul.tracklisting {
      list-style: none !important;
      padding: 0 !important;
    }
    ul.tracklisting li.track {
      border-bottom: 1px solid var(--mono-e, #eee) !important;
      padding: 0 !important;
    }
    ul.tracklisting li.track:last-child {
      border-bottom: none !important;
    }
    .tracklist_line {
      display: flex !important;
      align-items: center !important;
      padding: 9px 4px !important;
      gap: 10px !important;
    }
    .tracklist_num {
      color: var(--mono-c, #ccc) !important;
      font-size: 11px !important;
      min-width: 20px !important;
      text-align: right !important;
      flex-shrink: 0 !important;
    }
    .tracklist_title {
      font-size: 13px !important;
      font-weight: 500 !important;
      flex: 1 !important;
    }
    .tracklist_title a.song {
      color: var(--mono-2, #333) !important;
      text-decoration: none !important;
    }
    .tracklist_title a.song:hover {
      color: var(--gen-blue-dark, #2a5298) !important;
    }
    .tracklist_duration {
      color: var(--mono-9, #aaa) !important;
      font-size: 12px !important;
      float: none !important;
      flex-shrink: 0 !important;
    }
    .tracklist_total {
      font-size: 11px !important;
      color: var(--mono-8, #aaa) !important;
      padding: 8px 4px !important;
    }

    /* ── Rate / Catalog section ──────────────────── */
    /* UNCONFIRMED: .release_my_catalog, .my_catalog_rating, */
    /* .catalog_btn, .listening_btn, .tag_btn, .review_btn, */
    /* .track_rating_btn, .bump_btn */
    .release_my_catalog {
      display: flex !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      gap: 8px !important;
      padding: 12px 0 !important;
    }
    .my_catalog_rating {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }
    .catalog_btn,
    .listening_btn,
    .tag_btn,
    .review_btn,
    .track_rating_btn,
    .bump_btn {
      background: transparent !important;
      border: 1px solid var(--mono-d, #ddd) !important;
      color: var(--mono-5, #666) !important;
      border-radius: 6px !important;
      padding: 6px 12px !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      white-space: nowrap !important;
    }
    .catalog_btn:hover,
    .listening_btn:hover,
    .tag_btn:hover,
    .review_btn:hover,
    .track_rating_btn:hover,
    .bump_btn:hover {
      border-color: var(--mono-9, #aaa) !important;
      color: var(--mono-2, #222) !important;
    }
    /* catalog button when active (in collection) */
    .catalog_btn.catalog_o {
      background: color-mix(in srgb, var(--gen-blue-dark, #2a5298) 12%, transparent) !important;
      border-color: transparent !important;
      color: var(--gen-blue-dark, #2a5298) !important;
      font-weight: 600 !important;
    }

    /* ── Section headers ─────────────────────────── */
    /* UNCONFIRMED: .release_page_header */
    .release_page_header h2 {
      font-size: 11px !important;
      text-transform: uppercase !important;
      letter-spacing: 0.12em !important;
      font-weight: 700 !important;
      color: var(--mono-8, #aaa) !important;
      padding-bottom: 6px !important;
    }

    /* ── Page header tweaks ──────────────────────── */
    /* UNCONFIRMED: #page_header */
    #page_header {
      box-shadow: 0 1px 0 rgba(0,0,0,0.08) !important;
    }

    /* ── Ad slot alignment ───────────────────────── */
    /* UNCONFIRMED: .album_info_outer */
    .album_info_outer > tbody > tr > td:last-child {
      vertical-align: top !important;
    }

    /* ── Color bar: slightly thicker, rounded ────── */
    /* UNCONFIRMED: table.color_bar */
    table.color_bar {
      border-radius: 2px !important;
      overflow: hidden !important;
      height: 4px !important;
      margin-bottom: 12px !important;
    }
    table.color_bar td {
      height: 4px !important;
      padding: 0 !important;
    }

  `);

  // ─── DOM MANIPULATION ─────────────────────────────────────────────────────

  function applyDomChanges() {
    if (DEBUG) { runDiagnostics(); }

    // 1. Wrap the rating row content so the score number is visually dominant.
    //    CONFIRMED: .avg_rating is high-confidence.
    const avgRating = document.querySelector('.avg_rating');
    if (avgRating) {
      const ratingRow = avgRating.closest('tr');
      if (ratingRow) {
        const td = ratingRow.querySelector('td');
        if (td) {
          td.style.cssText = 'line-height:1; padding-bottom:12px';
        }
      }
    }

    // 2. Insert a visual gap between primary and secondary genre chip groups.
    //    CONFIRMED: both selectors verified.
    try {
      const priGenres = document.querySelector('.release_pri_genres');
      const secGenres = document.querySelector('.release_sec_genres');
      if (priGenres && secGenres) {
        const gap = document.createElement('div');
        gap.style.cssText = 'height:6px';
        priGenres.parentNode.insertBefore(gap, secGenres);
      }
    } catch (e) {
      if (DEBUG) { console.warn('[RYM-redesign] genre gap pass failed:', e); }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDomChanges);
  } else {
    applyDomChanges();
  }

})();
