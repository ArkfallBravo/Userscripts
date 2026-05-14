// ==UserScript==
// @name         RYM Chart Quick Filter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Streamlined single-input filter for RYM custom charts. Set mode once, type to search, click to apply.
// @author       Helena S.
// @match        https://rateyourmusic.com/charts/*
// @match        http://rateyourmusic.com/charts/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rateyourmusic.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let mode = 'include';    // 'include' | 'exclude'
  let pool = 'genre';      // 'genre' | 'influence' | 'both' | 'descriptor'
  let debounceTimer = null;
  const cache = new Map();

  // ── Helpers ────────────────────────────────────────────────────────────────
  function filterType() {
    if (pool === 'descriptor') return mode === 'include' ? 'descriptor_include'    : 'descriptor_exclude';
    if (pool === 'genre')      return mode === 'include' ? 'genre_include'          : 'genre_exclude';
    if (pool === 'influence')  return mode === 'include' ? 'sec_genre_include'      : 'sec_genre_exclude';
    /* both */                 return mode === 'include' ? 'genre_either_include'   : 'genre_either_exclude';
  }

  function resultName(r) {
    return r.display_name || r.name || '';
  }

  function matchesScope(r) {
    const scope = pool === 'descriptor' ? 'descriptor' : 'genre';
    if (typeof r.type === 'string') return r.type === scope;
    if (typeof r.path === 'string') {
      if (scope === 'descriptor') return r.path.startsWith('d:');
      return r.path.startsWith('g:') || !r.path.includes(':');
    }
    return false;
  }

  // ── API ────────────────────────────────────────────────────────────────────
  function fetchSuggestions(q) {
    const cacheKey = q.toLowerCase().trim() + ':' + (pool === 'descriptor' ? 'd' : 'g');
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const url = new URL('/api/1/browse/music/', window.location.origin);
    url.searchParams.set('q', q);
    url.searchParams.set('component', '');

    const promise = fetch(url.toString(), { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        return (data.results || []).filter(matchesScope).slice(0, 8);
      });

    cache.set(cacheKey, promise);
    return promise;
  }

  // ── Chart integration ──────────────────────────────────────────────────────
  function applyItem(r) {
    const name = resultName(r);
    const path = r.path || '';
    if (!name || !path) return;

    const ft = filterType();
    const chart = window.RYMchart;
    if (chart && typeof chart.addBrowserItem === 'function') {
      try { chart.addBrowserItem(ft, path, name); } catch (e) { console.error('addBrowserItem failed', e); }
    }
    if (chart && typeof chart.onClickCreateChart === 'function') {
      try { chart.onClickCreateChart(); } catch (e) { console.error('onClickCreateChart failed', e); }
    }
  }

  // ── CSS ────────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('ebr-qf-style')) return;
    const style = document.createElement('style');
    style.id = 'ebr-qf-style';
    style.textContent = `
      .ebr-qf-panel {
        padding: .6em .6em .8em;
        border-bottom: 1px solid var(--mono-d, #ddd);
        margin-bottom: .5em;
      }
      .ebr-qf-toggles {
        display: flex;
        flex-wrap: wrap;
        gap: .4em;
        margin-bottom: .5em;
      }
      .ebr-qf-group {
        display: flex;
        gap: 2px;
      }
      .ebr-qf-btn {
        padding: .2em .55em;
        font-size: .8em;
        border: 1px solid var(--mono-c, #ccc);
        border-radius: 3px;
        background: var(--mono-f8, #f8f8f8);
        color: var(--text-primary, #333);
        cursor: pointer;
        line-height: 1.5;
      }
      .ebr-qf-btn.active {
        background: var(--primary, #207bbf);
        border-color: var(--primary, #207bbf);
        color: #fff;
      }
      .ebr-qf-input-wrap {
        position: relative;
      }
      .ebr-qf-input {
        width: 100%;
        padding: .35em .55em;
        border: 1px solid var(--mono-c, #ccc);
        border-radius: 3px;
        background: var(--surface-primary, #fff);
        color: var(--text-primary, #000);
        font-size: .9em;
        box-sizing: border-box;
        outline: none;
      }
      .ebr-qf-input:focus { border-color: var(--primary, #207bbf); }
      .ebr-qf-dropdown {
        position: absolute;
        z-index: 200;
        top: calc(100% + 2px);
        left: 0;
        right: 0;
        background: var(--surface-primary, #fff);
        border: 1px solid var(--mono-c, #ccc);
        border-radius: 3px;
        box-shadow: 0 2px 6px rgba(0,0,0,.15);
        max-height: 14em;
        overflow-y: auto;
      }
      .ebr-qf-item {
        padding: .35em .6em;
        cursor: pointer;
        font-size: .9em;
        color: var(--text-primary, #000);
      }
      .ebr-qf-item:hover, .ebr-qf-item.ebr-qf-active {
        background: var(--surface-secondary, #f0f0f0);
      }
    `;
    document.head.appendChild(style);
  }

  // ── Build UI ───────────────────────────────────────────────────────────────
  function buildPanel() {
    const panel = document.createElement('div');
    panel.className = 'ebr-qf-panel';

    // Toggle rows
    const toggles = document.createElement('div');
    toggles.className = 'ebr-qf-toggles';

    const modeGroup = document.createElement('div');
    modeGroup.className = 'ebr-qf-group';

    const poolGroup = document.createElement('div');
    poolGroup.className = 'ebr-qf-group';

    function makeBtn(label, group, value, currentGetter, setter) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ebr-qf-btn' + (currentGetter() === value ? ' active' : '');
      btn.textContent = label;
      btn.onclick = function () {
        setter(value);
        group.querySelectorAll('.ebr-qf-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        // clear cache entries that depend on scope when pool changes
        if (setter !== setMode) cache.clear();
        input.value = '';
        hideDropdown();
      };
      return btn;
    }

    function setMode(v) { mode = v; }
    function setPool(v) { pool = v; }

    modeGroup.appendChild(makeBtn('Include',   modeGroup, 'include',   function () { return mode; }, setMode));
    modeGroup.appendChild(makeBtn('Exclude',   modeGroup, 'exclude',   function () { return mode; }, setMode));

    poolGroup.appendChild(makeBtn('Genre',      poolGroup, 'genre',      function () { return pool; }, setPool));
    poolGroup.appendChild(makeBtn('Influence',  poolGroup, 'influence',  function () { return pool; }, setPool));
    poolGroup.appendChild(makeBtn('Both',       poolGroup, 'both',       function () { return pool; }, setPool));
    poolGroup.appendChild(makeBtn('Descriptor', poolGroup, 'descriptor', function () { return pool; }, setPool));

    toggles.appendChild(modeGroup);
    toggles.appendChild(poolGroup);
    panel.appendChild(toggles);

    // Input + dropdown
    const inputWrap = document.createElement('div');
    inputWrap.className = 'ebr-qf-input-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ebr-qf-input';
    input.placeholder = 'Search and click to apply…';
    input.autocomplete = 'off';

    const dropdown = document.createElement('div');
    dropdown.className = 'ebr-qf-dropdown';
    dropdown.style.display = 'none';

    function showDropdown(results) {
      dropdown.innerHTML = '';
      if (!results.length) { hideDropdown(); return; }
      results.forEach(function (r) {
        const item = document.createElement('div');
        item.className = 'ebr-qf-item';
        item.textContent = resultName(r);
        item.onmousedown = function (e) {
          e.preventDefault();
          applyItem(r);
          input.value = '';
          hideDropdown();
        };
        dropdown.appendChild(item);
      });
      dropdown.style.display = '';
    }

    function hideDropdown() {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
    }

    input.addEventListener('input', function () {
      const q = input.value.trim();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (!q) { hideDropdown(); return; }
      debounceTimer = setTimeout(function () {
        fetchSuggestions(q).then(showDropdown).catch(function () { hideDropdown(); });
      }, 200);
    });

    input.addEventListener('blur', function () {
      setTimeout(hideDropdown, 150);
    });

    inputWrap.appendChild(input);
    inputWrap.appendChild(dropdown);
    panel.appendChild(inputWrap);

    return panel;
  }

  // ── Mount ──────────────────────────────────────────────────────────────────
  function mount() {
    const container = document.querySelector('.page_chart_query_free_section_new');
    if (!container) return;
    injectStyles();
    container.insertBefore(buildPanel(), container.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
