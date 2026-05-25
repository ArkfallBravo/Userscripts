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
  let topLevelCategories = [];       // names of categories not nested inside another parent
  let categoryFetchPromise = null;

  function saveExcludedCategories() {
    try { localStorage.setItem(DS_EXCL_KEY, JSON.stringify([...excludedCategories])); } catch (_) {}
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

  // Filter descriptors by excluded categories, then return up to 8.
  function filterAndSlice(descriptors) {
    if (!descriptorCategoryMap || excludedCategories.size === 0) return descriptors.slice(0, 8);
    const excludedSlugs = new Set();
    excludedCategories.forEach(function (cat) {
      const slugs = descriptorCategoryMap.get(cat);
      if (slugs) slugs.forEach(function (s) { excludedSlugs.add(s); });
    });
    return descriptors.filter(function (d) { return !excludedSlugs.has(d); }).slice(0, 8);
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
  function buildChartUrlWithGenreCfg(genres, influences, primarySlugs, influenceSlugs) {
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
    if (gItems.length)  parts.push('g:all,'  + gItems.join(','));
    if (geItems.length) parts.push('ge:all,' + geItems.join(','));
    return 'https://rateyourmusic.com/charts/top/album,ep,mixtape,djmix/all-time/' + parts.join('/') + '/excl:ratings/';
  }

  // ── Button helpers ─────────────────────────────────────────────────────────

  function makeBtn(label, url) {
    const btn = document.createElement('div');
    btn.className = 'more_btn';
    btn.textContent = label;
    btn.style.fontSize = '12px';
    btn.style.lineHeight = '27.6px';
    btn.onclick = function () { window.open(url, '_blank'); };
    return btn;
  }

  function makeAsyncBtn(label, onClick) {
    const btn = document.createElement('div');
    btn.className = 'more_btn';
    btn.textContent = label;
    btn.style.fontSize = '12px';
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
    const panel = document.createElement('div');
    panel.style.cssText = 'padding:4px 2px 6px;';

    // One shared grid — all rows share the same label column width.
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:max-content 1fr; column-gap:4px; row-gap:2px;';
    panel.appendChild(grid);

    function labelCell(text) {
      const el = document.createElement('div');
      el.style.cssText = 'display:flex; align-items:flex-start; padding-top:2px; font-size:11px; opacity:0.55; white-space:nowrap;';
      el.textContent = text;
      return el;
    }

    function bubbleCell(chips) {
      const el = document.createElement('div');
      el.style.cssText = 'display:flex; align-items:center; gap:4px; flex-wrap:wrap;';
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
    grid.appendChild(labelCell('Genres:'));
    grid.appendChild(bubbleCell([
      makeGenreToggle('genre',     function () { return genreCfg.genreToG;  }, function (v) { genreCfg.genreToG  = v; }),
      makeGenreToggle('influence', function () { return genreCfg.genreToGe; }, function (v) { genreCfg.genreToGe = v; }),
    ]));
    grid.appendChild(labelCell(''));
    grid.appendChild(bubbleCell([
      makeGenreToggle('use parents for genre',     function () { return genreCfg.genreParToG;  }, function (v) { genreCfg.genreParToG  = v; }),
      makeGenreToggle('use parents for influence', function () { return genreCfg.genreParToGe; }, function (v) { genreCfg.genreParToGe = v; }),
    ]));

    // ── Influences rows ──
    grid.appendChild(labelCell('Influences:'));
    grid.appendChild(bubbleCell([
      makeGenreToggle('genre',     function () { return genreCfg.inflToG;  }, function (v) { genreCfg.inflToG  = v; }),
      makeGenreToggle('influence', function () { return genreCfg.inflToGe; }, function (v) { genreCfg.inflToGe = v; }),
    ]));
    grid.appendChild(labelCell(''));
    grid.appendChild(bubbleCell([
      makeGenreToggle('use parents for genre',     function () { return genreCfg.inflParToG;  }, function (v) { genreCfg.inflParToG  = v; }),
      makeGenreToggle('use parents for influence', function () { return genreCfg.inflParToGe; }, function (v) { genreCfg.inflParToGe = v; }),
    ]));

    // ── Descriptor rows (populated async) ──
    const descLabelCell = labelCell('Exclude descriptor\ncategories:');
    const descRow1 = bubbleCell([]);
    const descRow2 = bubbleCell([]);

    grid.appendChild(descLabelCell);
    grid.appendChild(descRow1);
    grid.appendChild(labelCell(''));
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

    // "Genres & Descriptors" — uses top 8 descriptors unfiltered
    const firstBtn = makeBtn('Genres & Descriptors', buildChartUrl(genres, influences, descriptors.slice(0, 8)));
    firstBtn.style.paddingLeft = '0.8em';
    firstBtn.style.marginLeft = '0';
    wrapper.appendChild(firstBtn);

    // "Just Genres" — async so it can fetch parent genres if configured
    wrapper.appendChild(makeAsyncBtn('Just Genres', async function () {
      const needParents = genreCfg.genreParToG || genreCfg.genreParToGe ||
                          genreCfg.inflParToG  || genreCfg.inflParToGe;
      let primarySlugs = [], influenceSlugs = [];
      if (needParents) {
        const result = await fetchParentGenres();
        primarySlugs  = result.primarySlugs;
        influenceSlugs = result.influenceSlugs;
      }
      window.open(buildChartUrlWithGenreCfg(genres, influences, primarySlugs, influenceSlugs), '_blank');
    }));

    // "Just Descriptors" — async so it can apply the category filter
    wrapper.appendChild(makeAsyncBtn('Just Descriptors', async function () {
      await fetchDescriptorCategoryMap(); // ensure map is ready
      const filtered = filterAndSlice(descriptors);
      window.open(buildChartUrl([], [], filtered), '_blank');
    }));


    const td = document.createElement('td');
    td.appendChild(wrapper);
    td.appendChild(makeChartSettingsPanel());

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
