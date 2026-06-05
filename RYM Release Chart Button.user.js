// ==UserScript==
// @name         RYM Release Chart Button
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Adds a button at the end of the main info section on release pages that opens a custom RYM chart with the release's genres, influences, and descriptors pre-set.
// @author       Helena S.
// @match        https://rateyourmusic.com/release/*
// @match        http://rateyourmusic.com/release/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rateyourmusic.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function slugify(text) {
    return text.trim().toLowerCase().replace(/\s+/g, '-');
  }

  function collectGenres() {
    const slugs = [];
    document.querySelectorAll('span.release_pri_genres a.genre').forEach(function (a) {
      const m = (a.getAttribute('href') || '').match(/\/genre\/([^/]+)\//);
      if (m) slugs.push(m[1]);
    });
    return slugs;
  }

  function collectInfluences() {
    const slugs = [];
    document.querySelectorAll('span.release_sec_genres a.genre').forEach(function (a) {
      const m = (a.getAttribute('href') || '').match(/\/genre\/([^/]+)\//);
      if (m) slugs.push(m[1]);
    });
    return slugs;
  }

  // Returns ALL descriptors (unsliced); callers slice as needed.
  function collectDescriptors() {
    const span = document.querySelector('span.release_pri_descriptors');
    if (!span || !span.textContent.trim()) return [];
    return span.textContent.split(',').map(function (s) { return slugify(s); }).filter(Boolean);
  }

  function buildChartUrl(genres, influences, descriptors) {
    const parts = [];
    if (genres.length)      parts.push('g:all,' + genres.join(','));
    if (influences.length)  parts.push('ge:all,' + influences.join(','));
    if (descriptors.length) parts.push('d:all,' + descriptors.join(','));
    return 'https://rateyourmusic.com/charts/top/album,ep,mixtape,djmix/all-time/' + parts.join('/') + '/excl:ratings/';
  }

  // ── Descriptor category filter ─────────────────────────────────────────────

  const DS_EXCL_KEY = 'rym-rcb-excluded-desc-cats';
  let excludedCategories = new Set(
    (function () { try { return JSON.parse(localStorage.getItem(DS_EXCL_KEY) || '[]'); } catch (_) { return []; } })()
  );
  let descriptorCategoryMap = null;  // Map<string, string[]>  category name → descriptor slugs
  let descriptorParentMap = null;    // Map<parentSlug, immediateChildSlugs[]>
  let topLevelCategories = [];       // names of categories not nested inside another parent
  let categoryFetchPromise = null;

  function saveExcludedCategories() {
    try { localStorage.setItem(DS_EXCL_KEY, JSON.stringify([...excludedCategories])); } catch (_) {}
  }

  const DS_QTY_KEY = 'rym-rcb-desc-qty';
  let descriptorQty = (function () {
    const v = localStorage.getItem(DS_QTY_KEY);
    if (v === null) return 8;       // not yet set → default
    if (v === 'null') return null;  // "all"
    const n = Number(v);
    return isNaN(n) ? 8 : n;        // handles 0 (none), 8, 12, 16
  })();

  function saveDescriptorQty() {
    try { localStorage.setItem(DS_QTY_KEY, String(descriptorQty)); } catch (_) {}
  }

  const EXCL_PAR_KEY = 'rym-rcb-excl-par-desc';
  let excludeParentDescs = localStorage.getItem(EXCL_PAR_KEY) === 'true';

  function saveExcludeParentDescs() {
    try { localStorage.setItem(EXCL_PAR_KEY, String(excludeParentDescs)); } catch (_) {}
  }

  function fetchDescriptorCategoryMap() {
    if (descriptorCategoryMap) return Promise.resolve(descriptorCategoryMap);
    if (categoryFetchPromise) return categoryFetchPromise;
    categoryFetchPromise = fetch('https://rateyourmusic.com/music_descriptor/', { credentials: 'include' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const map = new Map();

        // Each parent descriptor is bold: <b><a class="genre" href="/music_descriptor/SLUG/">Name</a></b>
        // All children (including nested sub-parents) are a.genre links inside the same container div.
        // Descriptor hrefs use + for spaces; slugify to match what collectDescriptors() produces.
        function normalizeSlug(href) {
          const m = (href || '').match(/\/music_descriptor\/([^/?#]+)/);
          if (!m) return null;
          return slugify(decodeURIComponent(m[1].replace(/\+/g, ' ')));
        }

        doc.querySelectorAll('b > a.genre[href*="/music_descriptor/"]').forEach(function (parentLink) {
          const catName = parentLink.textContent.trim();
          const container = parentLink.closest('div');
          if (!container) return;
          const slugs = [];
          container.querySelectorAll('a.genre[href*="/music_descriptor/"]').forEach(function (a) {
            const s = normalizeSlug(a.getAttribute('href'));
            if (s) slugs.push(s);
          });
          if (slugs.length > 0) {
            map.set(catName, slugs);
            // Top-level = not nested inside another parent's blockquote
            if (!parentLink.closest('blockquote')) topLevelCategories.push(catName);
          }
        });

        // Build parent→immediate-children map for individual descriptors.
        // Structure: <div><b><a class="genre">Parent</a></b> [edit links] [desc div] <br> <blockquote>children</blockquote></div>
        // The blockquote is a direct child of the same div as <b>, not the immediate next sibling.
        const parentMap = new Map();
        doc.querySelectorAll('b > a.genre[href*="/music_descriptor/"]').forEach(function (parentLink) {
          const parentSlug = normalizeSlug(parentLink.getAttribute('href'));
          if (!parentSlug) return;
          const parentDiv = parentLink.parentElement.parentElement; // <b>'s parent div
          const blockquote = Array.from(parentDiv.children).find(function (el) { return el.tagName === 'BLOCKQUOTE'; });
          if (!blockquote) return;
          const children = [];
          blockquote.querySelectorAll('a.genre[href*="/music_descriptor/"]').forEach(function (a) {
            // Only immediate children: closest blockquote ancestor must be THIS blockquote
            if (a.closest('blockquote') === blockquote) {
              const s = normalizeSlug(a.getAttribute('href'));
              if (s) children.push(s);
            }
          });
          if (children.length) parentMap.set(parentSlug, children);
        });
        descriptorParentMap = parentMap;

        descriptorCategoryMap = map;
        return map;
      })
      .catch(function (e) {
        console.error('[rym-rcb] fetchDescriptorCategoryMap failed:', e);
        descriptorCategoryMap = new Map();
        return descriptorCategoryMap;
      });
    return categoryFetchPromise;
  }

  // Filter descriptors by excluded categories, then slice to the configured quantity.
  function filterAndSlice(descriptors) {
    let result = descriptors;
    if (descriptorCategoryMap && excludedCategories.size > 0) {
      const excludedSlugs = new Set();
      excludedCategories.forEach(function (cat) {
        const slugs = descriptorCategoryMap.get(cat);
        if (slugs) slugs.forEach(function (s) { excludedSlugs.add(s); });
      });
      result = result.filter(function (d) { return !excludedSlugs.has(d); });
    }
    const sliced = descriptorQty === null ? result : result.slice(0, descriptorQty);
    if (!excludeParentDescs) return sliced;
    const pool = result.filter(function (d) { return sliced.indexOf(d) === -1; });
    return applyExcludeParents(sliced, pool);
  }

  // Returns true if `ancestor` is a direct or indirect parent of `descendant`.
  function isAncestorOf(ancestor, descendant, visited) {
    if (!descriptorParentMap) return false;
    visited = visited || new Set();
    if (visited.has(ancestor)) return false;
    visited.add(ancestor);
    const children = descriptorParentMap.get(ancestor) || [];
    for (let i = 0; i < children.length; i++) {
      if (children[i] === descendant) return true;
      if (isAncestorOf(children[i], descendant, visited)) return true;
    }
    return false;
  }

  // Remove any descriptor that is an ancestor (at any depth) of another
  // descriptor in the selected set, replacing it with the next from pool.
  function applyExcludeParents(selected, pool) {
    if (!descriptorParentMap) return selected;
    const result = selected.slice();
    const remaining = pool.slice();
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < result.length; i++) {
        const isAnc = result.some(function (other, j) {
          return j !== i && isAncestorOf(result[i], other);
        });
        if (isAnc) {
          result.splice(i, 1);
          if (remaining.length) result.push(remaining.shift());
          changed = true;
          break;
        }
      }
    }
    return result;
  }

  // ── Genre config ───────────────────────────────────────────────────────────
  //
  // Each flag independently controls one contribution to the chart URL.
  // "use parents" flags supersede the corresponding direct flag for their filter.
  //
  // Genres row  (source = release's primary genres):
  //   genreToG      → genres directly into g:
  //   genreToGe     → genres directly into ge:
  //   genreParToG   → parent genres into g:   (overrides genreToG)
  //   genreParToGe  → parent genres into ge:  (overrides genreToGe)
  //
  // Influences row  (source = release's secondary genres / influences):
  //   inflToG       → influences directly into g:
  //   inflToGe      → influences directly into ge:
  //   inflParToG    → parent influences into g:   (overrides inflToG)
  //   inflParToGe   → parent influences into ge:  (overrides inflToGe)

  const GENRE_CFG_KEY = 'rym-rcb-genre-cfg';
  const GENRE_CFG_DEFAULTS = {
    genreToG: true,  genreToGe: false, genreParToG: false, genreParToGe: false,
    inflToG:  false, inflToGe:  true,  inflParToG:  false, inflParToGe:  false,
  };
  let genreCfg = Object.assign({}, GENRE_CFG_DEFAULTS);
  try {
    const saved = JSON.parse(localStorage.getItem(GENRE_CFG_KEY));
    if (saved) genreCfg = Object.assign(genreCfg, saved);
  } catch (_) {}

  function saveGenreCfg() {
    try { localStorage.setItem(GENRE_CFG_KEY, JSON.stringify(genreCfg)); } catch (_) {}
  }

  // Build chart URL from already-resolved genre/influence arrays + optional parent arrays.
  // "use parents" flags supersede the corresponding direct flag.
  function buildChartUrlWithGenreCfg(genres, influences, primarySlugs, influenceSlugs, descriptors) {
    const gItems = [];
    if      (genreCfg.genreParToG) gItems.push(...primarySlugs);
    else if (genreCfg.genreToG)    gItems.push(...genres);
    if      (genreCfg.inflParToG)  gItems.push(...influenceSlugs);
    else if (genreCfg.inflToG)     gItems.push(...influences);

    const geItems = [];
    if      (genreCfg.genreParToGe) geItems.push(...primarySlugs);
    else if (genreCfg.genreToGe)    geItems.push(...genres);
    if      (genreCfg.inflParToGe)  geItems.push(...influenceSlugs);
    else if (genreCfg.inflToGe)     geItems.push(...influences);

    const parts = [];
    if (gItems.length)                      parts.push('g:all,'  + gItems.join(','));
    if (geItems.length)                     parts.push('ge:all,' + geItems.join(','));
    if (descriptors && descriptors.length)  parts.push('d:all,'  + descriptors.join(','));
    return 'https://rateyourmusic.com/charts/top/album,ep,mixtape,djmix/all-time/' + parts.join('/') + '/excl:ratings/';
  }

  // ── Button helpers ─────────────────────────────────────────────────────────

  function makeBtn(label, url) {
    const btn = document.createElement('div');
    btn.className = 'more_btn';
    btn.textContent = label;
    btn.style.lineHeight = '27.6px';
    btn.onclick = function () { window.open(url, '_blank'); };
    return btn;
  }

  function makeAsyncBtn(label, onClick) {
    const btn = document.createElement('div');
    btn.className = 'more_btn';
    btn.textContent = label;
    btn.style.lineHeight = '27.6px';
    btn.onclick = async function () {
      btn.textContent = '…';
      btn.style.pointerEvents = 'none';
      try {
        await onClick();
      } catch (e) {
        console.error('[ebr-chart-btn]', e);
        btn.textContent = 'Error';
      } finally {
        btn.textContent = label;
        btn.style.pointerEvents = '';
      }
    };
    return btn;
  }

  // ── Combined chart settings panel (always visible) ────────────────────────

  function makeChartSettingsPanel() {
    const BASE_PX   = 4;
    const CHIP_GAP  = BASE_PX + 'px';      // space between chips within a row
    const ROW_GAP   = BASE_PX + 'px';      // space between rows within a group
    const GROUP_GAP = 2 * BASE_PX + 'px';  // extra top margin before each new group; total inter-group space = 2 × ROW_GAP

    const panel = document.createElement('div');
    panel.style.cssText = 'padding:4px 2px 6px;';

    // One shared grid — all rows share the same label column width.
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:max-content 1fr; column-gap:4px; row-gap:' + ROW_GAP + ';';
    panel.appendChild(grid);

    function labelCell(text) {
      const el = document.createElement('div');
      el.style.cssText = 'display:flex; align-items:flex-start; padding-top:2px; font-size:11px; opacity:0.55; white-space:nowrap;';
      el.textContent = text;
      return el;
    }

    function bubbleCell(chips) {
      const el = document.createElement('div');
      el.style.cssText = 'display:flex; align-items:center; gap:' + CHIP_GAP + '; flex-wrap:wrap;';
      chips.forEach(function (c) { el.appendChild(c); });
      return el;
    }

    // Genre toggle chip (currentColor fill when active).
    function makeGenreToggle(label, getVal, setVal) {
      const chip = document.createElement('span');
      chip.style.cssText = [
        'display:inline-flex', 'align-items:center', 'gap:4px',
        'cursor:pointer', 'font-size:11px', 'padding:1px 6px 1px 4px',
        'border-radius:3px', 'user-select:none', 'border:1px solid currentColor',
        'opacity:0.65', 'transition:opacity 0.1s',
      ].join(';');
      const circle = document.createElement('span');
      circle.style.cssText = 'display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; transition:background 0.1s;';
      function refresh() {
        circle.style.background = getVal() ? 'currentColor' : 'transparent';
        circle.style.border     = '1px solid currentColor';
        chip.style.opacity      = getVal() ? '1' : '0.65';
      }
      refresh();
      chip.appendChild(circle);
      chip.appendChild(document.createTextNode(label));
      chip.addEventListener('click', function () { setVal(!getVal()); saveGenreCfg(); refresh(); });
      return chip;
    }

    // Descriptor category chip (red fill when excluded).
    function makeDescChip(catName) {
      const chip = document.createElement('span');
      chip.style.cssText = [
        'display:inline-flex', 'align-items:center', 'gap:4px',
        'cursor:pointer', 'font-size:11px', 'padding:1px 6px 1px 4px',
        'border-radius:3px', 'user-select:none', 'border:1px solid currentColor',
        'opacity:0.65', 'transition:opacity 0.1s',
      ].join(';');
      const circle = document.createElement('span');
      circle.style.cssText = 'display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; transition:background 0.1s;';
      function refresh() {
        const excluded = excludedCategories.has(catName);
        circle.style.background = excluded ? '#c0392b' : 'transparent';
        circle.style.border     = excluded ? '1px solid #c0392b' : '1px solid currentColor';
        chip.style.opacity      = excluded ? '1' : '0.65';
        chip.style.color        = excluded ? '#c0392b' : '';
        chip.style.border       = excluded ? '1px solid #c0392b' : '1px solid currentColor';
      }
      refresh();
      chip.appendChild(circle);
      chip.appendChild(document.createTextNode(catName));
      chip.addEventListener('click', function () {
        if (excludedCategories.has(catName)) excludedCategories.delete(catName);
        else excludedCategories.add(catName);
        saveExcludedCategories();
        refresh();
      });
      return chip;
    }

    // ── Genre rows ──
    grid.appendChild(labelCell('Release genres:'));
    grid.appendChild(bubbleCell([
      makeGenreToggle('in genre',     function () { return genreCfg.genreToG;  }, function (v) { genreCfg.genreToG  = v; }),
      makeGenreToggle('in influence', function () { return genreCfg.genreToGe; }, function (v) { genreCfg.genreToGe = v; }),
    ]));
    grid.appendChild(labelCell(''));
    grid.appendChild(bubbleCell([
      makeGenreToggle('parents in genre',     function () { return genreCfg.genreParToG;  }, function (v) { genreCfg.genreParToG  = v; }),
      makeGenreToggle('parents in influence', function () { return genreCfg.genreParToGe; }, function (v) { genreCfg.genreParToGe = v; }),
    ]));

    // ── Influences rows ──
    const inflLabelCell = labelCell('Release influences:');
    inflLabelCell.style.marginTop = GROUP_GAP;
    const inflRow1 = bubbleCell([
      makeGenreToggle('in genre',     function () { return genreCfg.inflToG;  }, function (v) { genreCfg.inflToG  = v; }),
      makeGenreToggle('in influence', function () { return genreCfg.inflToGe; }, function (v) { genreCfg.inflToGe = v; }),
    ]);
    inflRow1.style.marginTop = GROUP_GAP;
    grid.appendChild(inflLabelCell);
    grid.appendChild(inflRow1);
    grid.appendChild(labelCell(''));
    grid.appendChild(bubbleCell([
      makeGenreToggle('parents in genre',     function () { return genreCfg.inflParToG;  }, function (v) { genreCfg.inflParToG  = v; }),
      makeGenreToggle('parents in influence', function () { return genreCfg.inflParToGe; }, function (v) { genreCfg.inflParToGe = v; }),
    ]));

    // Quantity radio chip — only one active at a time.
    function makeQtyChip(label, value, allChips) {
      const chip = document.createElement('span');
      chip.style.cssText = [
        'display:inline-flex', 'align-items:center', 'gap:4px',
        'cursor:pointer', 'font-size:11px', 'padding:1px 6px 1px 4px',
        'border-radius:3px', 'user-select:none', 'border:1px solid currentColor',
        'opacity:0.65', 'transition:opacity 0.1s',
      ].join(';');
      const circle = document.createElement('span');
      circle.style.cssText = 'display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; transition:background 0.1s;';
      function refresh() {
        const active = descriptorQty === value;
        circle.style.background = active ? 'currentColor' : 'transparent';
        circle.style.border     = '1px solid currentColor';
        chip.style.opacity      = active ? '1' : '0.65';
      }
      refresh();
      chip.appendChild(circle);
      chip.appendChild(document.createTextNode(label));
      chip.addEventListener('click', function () {
        descriptorQty = (descriptorQty === value) ? 0 : value;
        saveDescriptorQty();
        allChips.forEach(function (c) { c.refresh(); });
      });
      chip.refresh = refresh;
      return chip;
    }

    // ── Descriptor quantity chips (created before grid rows so they can be referenced) ──
    const qtyChips = [];
    const chip8   = makeQtyChip('top 8',   8,    qtyChips);
    const chip12  = makeQtyChip('top 12',  12,   qtyChips);
    const chip16  = makeQtyChip('top 16',  16,   qtyChips);
    const chipAll = makeQtyChip('all', null, qtyChips);
    qtyChips.push(chip8, chip12, chip16, chipAll);

    // "Exclude parents of included" — red toggle chip, independent of qty.
    function makeExclParChip() {
      const chip = document.createElement('span');
      chip.style.cssText = [
        'display:inline-flex', 'align-items:center', 'gap:4px',
        'cursor:pointer', 'font-size:11px', 'padding:1px 6px 1px 4px',
        'border-radius:3px', 'user-select:none', 'border:1px solid currentColor',
        'opacity:0.65', 'transition:opacity 0.1s',
      ].join(';');
      const circle = document.createElement('span');
      circle.style.cssText = 'display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; transition:background 0.1s;';
      function refresh() {
        circle.style.background = excludeParentDescs ? '#c0392b' : 'transparent';
        circle.style.border     = excludeParentDescs ? '1px solid #c0392b' : '1px solid currentColor';
        chip.style.opacity      = excludeParentDescs ? '1' : '0.65';
        chip.style.color        = excludeParentDescs ? '#c0392b' : '';
        chip.style.border       = excludeParentDescs ? '1px solid #c0392b' : '1px solid currentColor';
      }
      refresh();
      chip.appendChild(circle);
      chip.appendChild(document.createTextNode('omit parents of included descriptors'));
      chip.addEventListener('click', function () {
        excludeParentDescs = !excludeParentDescs;
        saveExcludeParentDescs();
        refresh();
      });
      return chip;
    }

    // ── "Release descriptors" section header (full-width) ──
    const descHeader = document.createElement('div');
    descHeader.style.cssText = 'grid-column:1/-1; font-size:11px; opacity:0.55; margin-top:' + GROUP_GAP + ';';
    descHeader.textContent = 'Release descriptors';
    grid.appendChild(descHeader);

    // ── Include row (sub-row, indented label) ──
    const inclLabel = labelCell('Include:');
    inclLabel.style.paddingLeft = '8px';
    grid.appendChild(inclLabel);
    grid.appendChild(bubbleCell([chip8, chip12, chip16, chipAll]));

    // ── Exclude categories rows (populated async, indented label spanning 2 rows) ──
    const descLabelCell = labelCell('Exclude:');
    descLabelCell.style.gridRow = 'span 2';  // spans both chip rows so neither is inflated
    descLabelCell.style.paddingLeft = '8px';
    const descRow1 = bubbleCell([]);
    const descRow2 = bubbleCell([]);

    grid.appendChild(descLabelCell);
    grid.appendChild(descRow1);
    // no empty label cell — descLabelCell's span already covers col 1 row 2
    grid.appendChild(descRow2);

    fetchDescriptorCategoryMap().then(function (map) {
      if (map.size === 0 || topLevelCategories.length === 0) {
        const msg = document.createElement('span');
        msg.style.cssText = 'font-size:11px; opacity:0.6;';
        msg.textContent = 'Could not load categories.';
        descRow1.appendChild(msg);
        return;
      }
      const half = Math.ceil(topLevelCategories.length / 2);
      topLevelCategories.slice(0, half).forEach(function (cat) { descRow1.appendChild(makeDescChip(cat)); });
      topLevelCategories.slice(half).forEach(function (cat)    { descRow2.appendChild(makeDescChip(cat)); });
    });

    // ── Omit-parents row (empty label + chip, indented to match chip column) ──
    grid.appendChild(labelCell(''));
    grid.appendChild(bubbleCell([makeExclParChip()]));

    return panel;
  }

  // ── Album ID / parent genre helpers (unchanged) ────────────────────────────

  function getAlbumId() {
    const link = document.querySelector('a[href*="rgenre/set"]');
    if (link) {
      const m = (link.getAttribute('href') || '').match(/album_id=(\d+)/);
      if (m) return m[1];
    }
    const inp = document.querySelector('input[name="albumid"], input[name="album_id"]');
    if (inp) return inp.value;
    return null;
  }

  function loadGenreSetInFrame(albumId) {
    return new Promise(function (resolve, reject) {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute; width:0; height:0; border:0; visibility:hidden;';
      iframe.src = 'https://rateyourmusic.com/rgenre/set?album_id=' + albumId;

      let settled = false;
      const finish = function (fn) { if (settled) return; settled = true; fn(); };

      const poll = setInterval(function () {
        try {
          const doc = iframe.contentDocument;
          if (!doc) return;
          const links = doc.querySelectorAll('a.genre[href*="/genre/"]');
          if (links.length > 0) {
            finish(function () {
              clearInterval(poll);
              resolve(doc);
              setTimeout(function () { iframe.remove(); }, 0);
            });
          }
        } catch (e) { /* cross-origin while loading — ignore */ }
      }, 200);

      setTimeout(function () {
        finish(function () {
          clearInterval(poll);
          iframe.remove();
          reject(new Error('rgenre/set iframe timed out'));
        });
      }, 15000);

      document.body.appendChild(iframe);
    });
  }

  async function fetchParentGenres() {
    const albumId = getAlbumId();
    if (!albumId) throw new Error('album_id not found on release page');

    const doc = await loadGenreSetInFrame(albumId);

    const releaseGenres     = collectGenres();
    const releaseInfluences = collectInfluences();
    const primarySlugs      = new Set();
    const influenceSlugs    = new Set();

    doc.querySelectorAll('a.genre[href*="/genre/"]').forEach(function (a) {
      const m = (a.getAttribute('href') || '').match(/\/genre\/([^/]+)\//);
      if (!m) return;
      const thisSlug = m[1];

      const target = releaseInfluences.includes(thisSlug) ? influenceSlugs
                   : releaseGenres.includes(thisSlug)     ? primarySlugs
                   : null;
      if (!target) return;

      const containerDiv = a.parentElement;
      if (!containerDiv) return;
      const next = containerDiv.nextElementSibling;
      if (!next || next.tagName !== 'P') return;
      const text = next.textContent.trim();
      if (!text.startsWith('⤷')) return;
      text.replace(/^⤷\s*/, '').split(',').forEach(function (name) {
        const s = slugify(name);
        if (s) target.add(s);
      });
    });

    return {
      primarySlugs:   Array.from(primarySlugs),
      influenceSlugs: Array.from(influenceSlugs),
    };
  }

  // ── Main ───────────────────────────────────────────────────────────────────

  function addButton() {
    const table = document.querySelector('table.album_info');
    if (!table) return;

    const genres      = collectGenres();
    const influences  = collectInfluences();
    const descriptors = collectDescriptors(); // all descriptors, unsliced

    if (!genres.length && !influences.length && !descriptors.length) return;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex; flex-direction:row; flex-wrap:wrap;';

    // "Search" — combines genre config + descriptors (if qty > 0)
    const searchBtn = makeAsyncBtn('Search', async function () {
      const needParents = genreCfg.genreParToG || genreCfg.genreParToGe ||
                          genreCfg.inflParToG  || genreCfg.inflParToGe;
      let primarySlugs = [], influenceSlugs = [];
      if (needParents) {
        const r = await fetchParentGenres();
        primarySlugs   = r.primarySlugs;
        influenceSlugs = r.influenceSlugs;
      }
      let descList = [];
      if (descriptorQty !== 0) {
        await fetchDescriptorCategoryMap();
        descList = filterAndSlice(descriptors);
      }
      window.open(buildChartUrlWithGenreCfg(genres, influences, primarySlugs, influenceSlugs, descList), '_blank');
    });
    searchBtn.style.marginLeft = '0';
    wrapper.appendChild(searchBtn);

    // Settings toggle button + panel
    const settingsPanel = makeChartSettingsPanel();
    settingsPanel.style.display = 'none';
    const settingsBtn = document.createElement('div');
    settingsBtn.className = 'more_btn';
    settingsBtn.textContent = '⚙';
    settingsBtn.style.cssText = 'line-height:27.6px; cursor:pointer;';
    settingsBtn.addEventListener('click', function () {
      const open = settingsPanel.style.display !== 'none';
      settingsPanel.style.display = open ? 'none' : 'block';
    });
    wrapper.appendChild(settingsBtn);

    const td = document.createElement('td');
    td.setAttribute('colspan', '2');
    td.appendChild(wrapper);
    td.appendChild(settingsPanel);

    const th = document.createElement('th');
    th.className = 'info_hdr';
    th.textContent = 'Charts';

    const tr = document.createElement('tr');
    tr.appendChild(th);
    tr.appendChild(td);

    table.querySelector('tbody').appendChild(tr);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addButton);
  } else {
    addButton();
  }
})();
