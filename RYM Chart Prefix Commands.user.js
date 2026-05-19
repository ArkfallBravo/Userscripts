// ==UserScript==
// @name         RYM Chart Prefix Commands
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds prefix commands (+g/+i/+gi/-g/-i/-gi for genres, +d/-d for descriptors) to RYM's chart search box. Tab / Shift+Tab to cycle suggestions, Enter to apply.
// @author       Helena S.
// @match        https://rateyourmusic.com/charts/*
// @match        http://rateyourmusic.com/charts/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rateyourmusic.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const log = (...args) => console.log('[rym-chart-prefix]', ...args);
  log('script loaded, readyState:', document.readyState);

  // ── Prefix → filter type / scope mapping ───────────────────────────────────
  const PREFIX_MAP = {
    '+g':  { ft: 'genre_include',         scope: 'genre',      label: 'Include genre' },
    '-g':  { ft: 'genre_exclude',         scope: 'genre',      label: 'Exclude genre' },
    '+i':  { ft: 'sec_genre_include',     scope: 'genre',      label: 'Include influence' },
    '-i':  { ft: 'sec_genre_exclude',     scope: 'genre',      label: 'Exclude influence' },
    '+gi': { ft: 'genre_either_include',  scope: 'genre',      label: 'Include as genre or influence' },
    '-gi': { ft: 'genre_either_exclude',  scope: 'genre',      label: 'Exclude as genre or influence' },
    '+d':  { ft: 'descriptor_include',    scope: 'descriptor', label: 'Include descriptor' },
    '-d':  { ft: 'descriptor_exclude',    scope: 'descriptor', label: 'Exclude descriptor' },
  };

  const CONTAINER_ID = 'ui_browser_list_contents_page_charts_settings';
  const LIST_ID      = 'ui_browser_list_page_charts_settings';
  const INPUT_ID     = 'ui_browser_input_page_charts_settings';

  // ── State ──────────────────────────────────────────────────────────────────
  let suggestions   = [];
  let activeIndex   = 0;
  let currentCmd    = null;
  let debounceTimer = null;
  let originalKeyUp = null; // set at mount to RYM's inline handler, then wrapped
  const cache = new Map();

  // ── Helpers ────────────────────────────────────────────────────────────────
  function parseInput(text) {
    // Match longest prefix first (gi before g/i). Allow no query yet, or " " + query.
    const m = text.match(/^([+\-](?:gi|g|i|d))(?:\s+(.*))?$/i);
    if (!m) return null;
    const cmd = PREFIX_MAP[m[1].toLowerCase()];
    if (!cmd) return null;
    return Object.assign({}, cmd, { prefix: m[1].toLowerCase(), query: (m[2] || '').trim() });
  }

  function matchesScope(r, scope) {
    // API returns results with `component: "descriptor"` or `component: "genre"`
    // and paths like "descriptor/20178" or "genre/123".
    if (typeof r.component === 'string') return r.component === scope;
    if (typeof r.path === 'string') return r.path.startsWith(scope + '/');
    return false;
  }

  function fetchSuggestions(q, scope) {
    const key = scope + ':' + q.toLowerCase().trim();
    if (cache.has(key)) { log('fetchSuggestions (cache hit) for', key); return cache.get(key); }
    const url = new URL('/api/1/browse/music/', window.location.origin);
    url.searchParams.set('q', q);
    url.searchParams.set('component', '');
    log('fetchSuggestions firing for', key, 'url:', url.toString());
    const p = fetch(url.toString(), { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        const all = data.results || [];
        const filtered = all.filter(function (r) { return matchesScope(r, scope); }).slice(0, 12);
        log('fetchSuggestions response: total=', all.length, 'filtered=', filtered.length, 'sample=', all.slice(0, 3));
        return filtered;
      })
      .catch(function (e) { log('fetchSuggestions error:', e); return []; });
    cache.set(key, p);
    return p;
  }

  function applyItem(cmd, item) {
    const name = item.display_name || item.name || '';
    // API gives us assoc_id (e.g. 20178) which is what addBrowserItem expects.
    const itemId = item.assoc_id != null
      ? item.assoc_id
      : (function () { const m = (item.path || '').match(/\/(\d+)$/); return m ? parseInt(m[1], 10) : null; })();
    if (!name || itemId == null) return;
    log('applyItem: ft=', cmd.ft, 'id=', itemId, 'name=', name);

    const chart = window.RYMchart;
    if (chart && typeof chart.addBrowserItem === 'function') {
      // Suppress any internal onClickCreateChart that addBrowserItem might
      // trigger — user updates the chart manually via the "Update chart" link.
      const origCreate = chart.onClickCreateChart;
      chart.onClickCreateChart = function () { log('  blocked onClickCreateChart triggered by addBrowserItem'); };
      try {
        chart.addBrowserItem(cmd.ft, itemId, name);
      } catch (e) {
        console.error('addBrowserItem failed', e);
      } finally {
        chart.onClickCreateChart = origCreate;
      }
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── Rendering ──────────────────────────────────────────────────────────────
  function getContainer() { return document.getElementById(CONTAINER_ID); }

  function renderHint() {
    const container = getContainer();
    if (!container) return;
    container.innerHTML = `
      <div class="ui_browser_list_item ui_browser_list_item_category">
        <div class="ui_browser_list_item_category_title">Chart filter commands</div>
        <div class="ui_browser_list_item_category_description">
          +g &nbsp;genre &nbsp;·&nbsp; -g &nbsp;genre &nbsp;·&nbsp;
          +i &nbsp;influence &nbsp;·&nbsp; -i &nbsp;influence &nbsp;·&nbsp;
          +gi / -gi &nbsp;either &nbsp;·&nbsp;
          +d / -d &nbsp;descriptor
        </div>
      </div>`;
  }

  function render() {
    const container = getContainer();
    if (!container) return;

    if (!currentCmd) {
      // Out of prefix mode: leave RYM's own contents alone.
      return;
    }

    if (!currentCmd.query) {
      container.innerHTML = `<div class="ui_browser_list_item ui_browser_list_item_category">
        <div class="ui_browser_list_item_category_title">${escapeHtml(currentCmd.prefix)} …</div>
        <div class="ui_browser_list_item_category_description">${escapeHtml(currentCmd.label)} — type to search</div>
      </div>`;
      return;
    }

    if (!suggestions.length) {
      container.innerHTML = `<div class="ui_browser_list_item ui_browser_list_item_category">
        <div class="ui_browser_list_item_category_title">No matches</div>
        <div class="ui_browser_list_item_category_description">${escapeHtml(currentCmd.label)}</div>
      </div>`;
      return;
    }

    let html = '';
    suggestions.forEach(function (s, i) {
      const name = s.display_name || s.name || '';
      const activeCls = i === activeIndex ? ' ebr-active' : '';
      html += `<div class="ui_browser_list_item ui_browser_list_item_category${activeCls}" data-ebr-idx="${i}">
        <div class="ui_browser_list_item_category_title">${escapeHtml(name)}</div>
      </div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('[data-ebr-idx]').forEach(function (el) {
      el.addEventListener('mousedown', function (e) {
        e.preventDefault();
        const idx = parseInt(el.getAttribute('data-ebr-idx'), 10);
        applyItem(currentCmd, suggestions[idx]);
        resetInput();
      });
    });
  }

  function injectStyles() {
    if (document.getElementById('ebr-chart-prefix-style')) return;
    const s = document.createElement('style');
    s.id = 'ebr-chart-prefix-style';
    s.textContent = `
      .ui_browser_list_item.ebr-active {
        background: var(--surface-secondary, rgba(32, 123, 191, 0.15));
        outline: 2px solid var(--primary, #207bbf);
        outline-offset: -2px;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Input / keyboard handling ──────────────────────────────────────────────
  function resetInput() {
    const input = document.getElementById(INPUT_ID);
    if (input) input.value = '';
    leavePrefixMode();
    renderHint();
  }

  function showList() {
    const list = document.getElementById(LIST_ID);
    if (list) list.style.display = '';
  }

  function leavePrefixMode() {
    currentCmd = null;
    suggestions = [];
    activeIndex = 0;
  }

  function onInput(e) {
    const input = e.target;
    const cmd = parseInput(input.value);

    if (!cmd) {
      if (currentCmd !== null) leavePrefixMode();
      return;
    }

    currentCmd = cmd;
    activeIndex = 0;
    showList();

    if (!cmd.query) {
      suggestions = [];
      render();
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    // Render immediately so stale results don't sit visible during the debounce
    render();
    const captured = cmd;
    debounceTimer = setTimeout(function () {
      fetchSuggestions(cmd.query, cmd.scope).then(function (results) {
        if (!currentCmd || currentCmd.prefix !== captured.prefix || currentCmd.query !== captured.query) return;
        suggestions = results;
        activeIndex = 0;
        render();
      });
    }, 180);
  }

  function onKeyDown(e) {
    if (!currentCmd) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      if (!suggestions.length) return;
      activeIndex = (activeIndex + (e.shiftKey ? -1 : 1) + suggestions.length) % suggestions.length;
      render();
    } else if (e.key === 'Enter') {
      if (!suggestions.length) return;
      e.preventDefault();
      e.stopPropagation();
      applyItem(currentCmd, suggestions[activeIndex]);
      resetInput();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      resetInput();
    }
  }

  // ── Mount ──────────────────────────────────────────────────────────────────
  function mount() {
    log('mount() called');
    const input = document.getElementById(INPUT_ID);
    log('  input element:', input);
    if (!input) return;
    injectStyles();

    // Wrap onkeyup and onfocus so RYM's browser never renders its own list
    // while we are (or might be) in prefix mode.
    originalKeyUp = input.onkeyup;
    input.onkeyup = function (event) {
      const val = input.value.trim();
      if (currentCmd !== null || /^[+\-]/.test(val)) {
        log('  suppressing RYM keyup for:', val);
        return;
      }
      if (originalKeyUp) originalKeyUp.call(this, event);
    };

    const originalFocus = input.onfocus;
    input.onfocus = function (event) {
      // Always suppress RYM's focus handler; we control the list ourselves.
      // Show a hint instead of the Genres/Descriptors/Locations category list.
      showList();
      renderHint();
    };

    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeyDown, true);
    input.addEventListener('focus', function () { log('input focused, currentCmd:', currentCmd); });
    input.addEventListener('blur',  function () { log('input blurred, currentCmd:', currentCmd); });

    // Intercept RYMchart.removeBrowserItem to log removal attempts.
    // RYMchart may not exist yet, so poll briefly.
    let patchAttempts = 0;
    const patchInterval = setInterval(function () {
      if (++patchAttempts > 20) { clearInterval(patchInterval); return; }
      if (!window.RYMchart || typeof window.RYMchart.removeBrowserItem !== 'function') return;
      clearInterval(patchInterval);
      const orig = window.RYMchart.removeBrowserItem.bind(window.RYMchart);
      window.RYMchart.removeBrowserItem = function () {
        log('removeBrowserItem called, args:', Array.from(arguments));
        // Suppress RYM's internal call to onClickCreateChart during removal
        // so the chart doesn't auto-refresh — user can hit "Update chart" themselves.
        const origCreate = window.RYMchart.onClickCreateChart;
        window.RYMchart.onClickCreateChart = function () {
          log('  blocked onClickCreateChart triggered by removeBrowserItem');
        };
        try {
          return orig.apply(window.RYMchart, arguments);
        } finally {
          window.RYMchart.onClickCreateChart = origCreate;
        }
      };
      log('patched RYMchart.removeBrowserItem');
    }, 200);

    // Log clicks on chip remove buttons so we can see if the event reaches them.
    document.addEventListener('click', function (e) {
      const chip = e.target.closest('.page_chart_query_browser_item');
      if (chip) log('chip click — target:', e.target.tagName, e.target.className, 'chip id:', chip.id);
    }, true);

    // Watch the container: whenever RYM writes its own categorized list back
    // (recognisable by the id="ui_browser_list_item__…" elements it uses),
    // immediately replace it with our hint or active suggestion list.
    const container = getContainer();
    if (container) {
      new MutationObserver(function () {
        if (container.querySelector('[id^="ui_browser_list_item__"]')) {
          log('  RYM overwrote container, restoring our state');
          if (currentCmd !== null) {
            render();
          } else {
            renderHint();
          }
        }
      }).observe(container, { childList: true, subtree: true });
    }

    log('  listeners attached');
  }

  function tryMount() {
    if (document.getElementById(INPUT_ID)) {
      mount();
      return true;
    }
    return false;
  }

  if (!tryMount()) {
    log('input not found yet, watching for it');
    const obs = new MutationObserver(function () {
      if (tryMount()) {
        log('input found via MutationObserver, disconnecting');
        obs.disconnect();
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); log('MutationObserver timed out'); }, 15000);
  }
})();
