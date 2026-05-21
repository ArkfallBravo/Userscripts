// ==UserScript==
// @name         RYM Chart Prefix Commands
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Always-on genre/descriptor autocomplete for RYM charts. Ctrl+1/2/3 first genre · Ctrl+D first descriptor · Shift = exclude. Ctrl+` toggles exclude mode. Also supports +g/-g/+i/-i/+gi/-gi/+d/-d prefix mode.
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
  let currentCmd    = null; // non-null only in prefix mode
  let excludeMode   = false;
  let debounceTimer = null;
  let originalKeyUp = null;
  const cache = new Map();

  // ── Helpers ────────────────────────────────────────────────────────────────
  function parseInput(text) {
    const m = text.match(/^([+\-](?:gi|g|i|d))(?:\s+(.*))?$/i);
    if (!m) return null;
    const cmd = PREFIX_MAP[m[1].toLowerCase()];
    if (!cmd) return null;
    return Object.assign({}, cmd, { prefix: m[1].toLowerCase(), query: (m[2] || '').trim() });
  }

  function matchesScope(r, scope) {
    if (typeof r.component === 'string') return r.component === scope;
    if (typeof r.path === 'string') return r.path.startsWith(scope + '/');
    return false;
  }

  function fetchSuggestions(q, scope) {
    const key = scope + ':' + q.toLowerCase().trim();
    if (cache.has(key)) return cache.get(key);
    const url = new URL('/api/1/browse/music/', window.location.origin);
    url.searchParams.set('q', q);
    url.searchParams.set('component', '');
    const p = fetch(url.toString(), { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        const all = data.results || [];
        const filtered = scope === 'all'
          ? all.slice(0, 12)
          : all.filter(function (r) { return matchesScope(r, scope); }).slice(0, 12);
        return filtered;
      })
      .catch(function (e) { log('fetchSuggestions error:', e); return []; });
    cache.set(key, p);
    return p;
  }

  // Returns the filter type string for a given component, shortcut key, and exclude state.
  function filterTypeFor(component, key, exclude) {
    if (component === 'genre') {
      if (key === 1) return exclude ? 'genre_exclude'        : 'genre_include';
      if (key === 2) return exclude ? 'sec_genre_exclude'    : 'sec_genre_include';
      if (key === 3) return exclude ? 'genre_either_exclude' : 'genre_either_include';
    }
    if (component === 'descriptor') {
      if (key === 1) return exclude ? 'descriptor_exclude' : 'descriptor_include';
      // keys 2 and 3 don't apply to descriptors
    }
    return null;
  }

  // Returns the first suggestion of the given component type ('genre' or 'descriptor'), or null.
  function findFirstOfType(component) {
    return suggestions.find(function (s) {
      return (s.component || (s.path || '').split('/')[0]) === component;
    }) || null;
  }

  function applyItem(ft, item) {
    const name = item.display_name || item.name || '';
    const itemId = item.assoc_id != null
      ? item.assoc_id
      : (function () { const m = (item.path || '').match(/\/(\d+)$/); return m ? parseInt(m[1], 10) : null; })();
    if (!name || itemId == null) return;
    log('applyItem: ft=', ft, 'id=', itemId, 'name=', name);

    const chart = window.RYMchart;
    if (chart && typeof chart.addBrowserItem === 'function') {
      const origCreate = chart.onClickCreateChart;
      chart.onClickCreateChart = function () {};
      try {
        chart.addBrowserItem(ft, itemId, name);
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
        <div class="ui_browser_list_item_category_title">Chart filter shortcuts</div>
        <div class="ui_browser_list_item_category_description">
          Type to search &nbsp;·&nbsp;
          ^1/2/3 top genre &nbsp;·&nbsp; ^D top descriptor &nbsp;·&nbsp; +Shift = exclude<br>
          ^\` toggle exclude mode &nbsp;·&nbsp; Prefix: +g −g &nbsp;+i −i &nbsp;+gi −gi &nbsp;+d −d
        </div>
      </div>`;
  }

  function render() {
    showList();
    const container = getContainer();
    if (!container) return;

    if (currentCmd) {
      // ── Prefix mode ──
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
          applyItem(currentCmd.ft, suggestions[idx]);
          resetInput();
        });
      });
      return;
    }

    // ── Free mode ──
    if (!suggestions.length) return;

    const exclHtml = excludeMode
      ? ' <span style="color:var(--color-primary,#c0392b);font-weight:bold;">[EXCL]</span>'
      : '';
    let html = `<div class="ui_browser_list_item ui_browser_list_item_category">
      <div class="ui_browser_list_item_category_title">^1/2/3 top genre &nbsp;·&nbsp; ^D top descriptor &nbsp;·&nbsp; +Shift = exclude${exclHtml}</div>
      <div class="ui_browser_list_item_category_description">Tab to cycle &nbsp;·&nbsp; ^\` toggle exclude mode</div>
    </div>`;
    suggestions.forEach(function (s, i) {
      const name = s.display_name || s.name || '';
      const typeLabel = s.component === 'descriptor' ? 'd' : 'g';
      const activeCls = i === activeIndex ? ' ebr-active' : '';
      html += `<div class="ui_browser_list_item ui_browser_list_item_category${activeCls}" data-ebr-idx="${i}">
        <div class="ui_browser_list_item_category_title">${escapeHtml(name)}<span style="opacity:0.5;font-size:0.85em;margin-left:0.5em;">${typeLabel}</span></div>
      </div>`;
    });
    container.innerHTML = html;
    container.querySelectorAll('[data-ebr-idx]').forEach(function (el) {
      el.addEventListener('mousedown', function (e) {
        e.preventDefault();
        activeIndex = parseInt(el.getAttribute('data-ebr-idx'), 10);
        render();
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
    currentCmd  = null;
    suggestions = [];
    activeIndex = 0;
    excludeMode = false;
    renderHint();
  }

  function showList() {
    const list = document.getElementById(LIST_ID);
    if (list) list.style.display = 'block';
  }

  function leavePrefixMode() {
    currentCmd = null;
    suggestions = [];
    activeIndex = 0;
  }

  function scheduleSearch(q, scope, matchFn) {
    if (debounceTimer) clearTimeout(debounceTimer);
    render();
    debounceTimer = setTimeout(function () {
      fetchSuggestions(q, scope).then(function (results) {
        if (!matchFn()) return;
        suggestions = results;
        activeIndex = 0;
        render();
      });
    }, 180);
  }

  function onInput(e) {
    const input = e.target;
    const cmd = parseInput(input.value);

    if (cmd) {
      currentCmd = cmd;
      activeIndex = 0;
      showList();
      if (!cmd.query) {
        suggestions = [];
        render();
        return;
      }
      const captured = cmd;
      scheduleSearch(cmd.query, cmd.scope, function () {
        return currentCmd && currentCmd.prefix === captured.prefix && currentCmd.query === captured.query;
      });
      return;
    }

    // Free mode
    if (currentCmd !== null) leavePrefixMode();

    const q = input.value.trim();
    if (!q) {
      suggestions = [];
      renderHint();
      return;
    }

    showList();
    const capturedQ = q;
    scheduleSearch(q, 'all', function () {
      const inp = document.getElementById(INPUT_ID);
      return inp && inp.value.trim() === capturedQ;
    });
  }

  function onKeyDown(e) {
    // ^` — toggle exclude mode
    if (e.key === '`' && e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      excludeMode = !excludeMode;
      render();
      return;
    }

    // ^D / ^Shift+D — apply first descriptor in suggestions
    if (e.ctrlKey && e.key.toLowerCase() === 'd') {
      if (!suggestions.length) return;
      e.preventDefault();
      e.stopPropagation();
      const item = findFirstOfType('descriptor');
      if (!item) return;
      const ft = (e.shiftKey || excludeMode) ? 'descriptor_exclude' : 'descriptor_include';
      applyItem(ft, item);
      resetInput();
      return;
    }

    // ^1 / ^2 / ^3 / ^Shift+1/2/3 — apply first genre in suggestions
    if (e.ctrlKey && (e.key === '1' || e.key === '2' || e.key === '3')) {
      if (!suggestions.length) return;
      e.preventDefault();
      e.stopPropagation();
      const item = findFirstOfType('genre');
      if (!item) return;
      const ft = filterTypeFor('genre', parseInt(e.key), e.shiftKey || excludeMode);
      if (!ft) return;
      applyItem(ft, item);
      resetInput();
      return;
    }

    // ^Enter — apply highlighted suggestion (prefix mode) then update chart
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      if (currentCmd && suggestions.length) {
        applyItem(currentCmd.ft, suggestions[activeIndex]);
        resetInput();
      }
      const chart = window.RYMchart;
      if (chart && typeof chart.onClickCreateChart === 'function') {
        try { chart.onClickCreateChart(); } catch (err) { console.error('onClickCreateChart failed', err); }
      }
      return;
    }

    // Tab — cycle suggestions (both modes)
    if (e.key === 'Tab' && suggestions.length) {
      e.preventDefault();
      e.stopPropagation();
      activeIndex = (activeIndex + (e.shiftKey ? -1 : 1) + suggestions.length) % suggestions.length;
      render();
      return;
    }

    // Enter — apply in prefix mode only
    if (e.key === 'Enter' && currentCmd && suggestions.length) {
      e.preventDefault();
      e.stopPropagation();
      applyItem(currentCmd.ft, suggestions[activeIndex]);
      resetInput();
      return;
    }

    // Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      resetInput();
    }
  }

  // ── Mount ──────────────────────────────────────────────────────────────────
  function mount() {
    log('mount() called');
    const input = document.getElementById(INPUT_ID);
    if (!input) return;
    injectStyles();

    // Suppress RYM's keyup whenever we have text in the input (free mode takes over).
    originalKeyUp = input.onkeyup;
    input.onkeyup = function (event) {
      if (input.value.trim() || currentCmd !== null) return;
      if (originalKeyUp) originalKeyUp.call(this, event);
    };

    const originalFocus = input.onfocus;
    input.onfocus = function (event) {
      showList();
      if (suggestions.length) {
        render();
      } else {
        renderHint();
      }
    };

    const originalBlur = input.onblur;
    input.onblur = function (event) {
      if (currentCmd !== null || suggestions.length) return;
      if (originalBlur) originalBlur.call(this, event);
    };

    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onKeyDown, true);

    // Global ^Enter: update chart from anywhere on the page.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.ctrlKey && document.activeElement !== input) {
        e.preventDefault();
        e.stopPropagation();
        const chart = window.RYMchart;
        if (chart && typeof chart.onClickCreateChart === 'function') {
          try { chart.onClickCreateChart(); } catch (err) { console.error('onClickCreateChart failed', err); }
        }
      }
    }, true);

    // Patch RYMchart.removeBrowserItem to suppress auto chart update on chip removal.
    let patchAttempts = 0;
    const patchInterval = setInterval(function () {
      if (++patchAttempts > 20) { clearInterval(patchInterval); return; }
      if (!window.RYMchart || typeof window.RYMchart.removeBrowserItem !== 'function') return;
      clearInterval(patchInterval);
      const orig = window.RYMchart.removeBrowserItem.bind(window.RYMchart);
      window.RYMchart.removeBrowserItem = function () {
        const origCreate = window.RYMchart.onClickCreateChart;
        window.RYMchart.onClickCreateChart = function () {};
        try {
          return orig.apply(window.RYMchart, arguments);
        } finally {
          window.RYMchart.onClickCreateChart = origCreate;
        }
      };
    }, 200);

    // MutationObserver: restore our content if RYM overwrites the container.
    const container = getContainer();
    if (container) {
      new MutationObserver(function () {
        if (container.querySelector('[id^="ui_browser_list_item__"]')) {
          if (currentCmd !== null || suggestions.length) {
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
    const obs = new MutationObserver(function () {
      if (tryMount()) obs.disconnect();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 15000);
  }
})();
