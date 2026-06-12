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

  // ─── color-scale.js (inlined) ─────────────────────────────────────────────

  function toeInv(x) {
    var k1 = 0.206;
    var k2 = 0.03;
    var k3 = (1 + k1) / (1 + k2);
    return (x * x + k1 * x) / (k3 * (x + k2));
  }

  function oklabToLinearSrgb(L, a, b) {
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    var l = l_ * l_ * l_;
    var m = m_ * m_ * m_;
    var s = s_ * s_ * s_;
    return [
      +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
  }

  function computeMaxSaturation(a_, b_) {
    var k0, k1, k2, k3, k4, wl, wm, ws;
    if (-1.88170328 * a_ - 0.80936493 * b_ > 1) {
      k0 = 1.19086277; k1 = 1.76576728; k2 = 0.59662641; k3 = 0.75515197; k4 = 0.56771245;
      wl = 4.0767416621; wm = -3.3077115913; ws = 0.2309699292;
    } else if (1.81444104 * a_ - 1.19445276 * b_ > 1) {
      k0 = 0.73956515; k1 = -0.45954404; k2 = 0.08285427; k3 = 0.12541070; k4 = 0.14503204;
      wl = -1.2684380046; wm = 2.6097574011; ws = -0.3413193965;
    } else {
      k0 = 1.35733652; k1 = -0.00915799; k2 = -1.15130210; k3 = -0.50559606; k4 = 0.00692167;
      wl = -0.0041960863; wm = -0.7034186147; ws = 1.7076147010;
    }
    var S = k0 + k1 * a_ + k2 * b_ + k3 * a_ * a_ + k4 * a_ * b_;
    var kl =  0.3963377774 * a_ + 0.2158037573 * b_;
    var km = -0.1055613458 * a_ - 0.0638541728 * b_;
    var ks = -0.0894841775 * a_ - 1.2914855480 * b_;
    var l_ = 1 + S * kl; var m_ = 1 + S * km; var s_ = 1 + S * ks;
    var l = l_ * l_ * l_; var m = m_ * m_ * m_; var s = s_ * s_ * s_;
    var ldS = 3 * kl * l_ * l_; var mdS = 3 * km * m_ * m_; var sdS = 3 * ks * s_ * s_;
    var ldS2 = 6 * kl * kl * l_; var mdS2 = 6 * km * km * m_; var sdS2 = 6 * ks * ks * s_;
    var f  = wl * l   + wm * m   + ws * s;
    var f1 = wl * ldS + wm * mdS + ws * sdS;
    var f2 = wl * ldS2 + wm * mdS2 + ws * sdS2;
    return S - f * f1 / (f1 * f1 - 0.5 * f * f2);
  }

  function findCusp(a_, b_) {
    var sCusp = computeMaxSaturation(a_, b_);
    var rgb = oklabToLinearSrgb(1, sCusp * a_, sCusp * b_);
    var lCusp = Math.pow(1 / Math.max(rgb[0], rgb[1], rgb[2]), 1 / 3);
    return [lCusp, lCusp * sCusp];
  }

  function findGamutIntersection(a_, b_, L1, C1, L0, cusp) {
    var t;
    if ((L1 - L0) * cusp[1] - (cusp[0] - L0) * C1 <= 0) {
      t = cusp[1] * L0 / (C1 * cusp[0] + cusp[1] * (L0 - L1));
    } else {
      t = cusp[1] * (L0 - 1) / (C1 * (cusp[0] - 1) + cusp[1] * (L0 - L1));
      var dL = L1 - L0;
      var dC = C1;
      var kl =  0.3963377774 * a_ + 0.2158037573 * b_;
      var km = -0.1055613458 * a_ - 0.0638541728 * b_;
      var ks = -0.0894841775 * a_ - 1.2914855480 * b_;
      var lDt = dL + dC * kl; var mDt = dL + dC * km; var sDt = dL + dC * ks;
      var L  = L0 * (1 - t) + t * L1;
      var C  = t * C1;
      var l_ = L + C * kl; var m_ = L + C * km; var s_ = L + C * ks;
      var lv = l_ * l_ * l_; var mv = m_ * m_ * m_; var sv = s_ * s_ * s_;
      var ldt = 3 * lDt * l_ * l_; var mdt = 3 * mDt * m_ * m_; var sdt = 3 * sDt * s_ * s_;
      var ldt2 = 6 * lDt * lDt * l_; var mdt2 = 6 * mDt * mDt * m_; var sdt2 = 6 * sDt * sDt * s_;
      var r  =  4.0767416621 * lv - 3.3077115913 * mv + 0.2309699292 * sv - 1;
      var r1 =  4.0767416621 * ldt - 3.3077115913 * mdt + 0.2309699292 * sdt;
      var r2 =  4.0767416621 * ldt2 - 3.3077115913 * mdt2 + 0.2309699292 * sdt2;
      var ur = r1 / (r1 * r1 - 0.5 * r * r2);
      var tr = ur >= 0 ? -r * ur : Number.MAX_VALUE;
      var g  = -1.2684380046 * lv + 2.6097574011 * mv - 0.3413193965 * sv - 1;
      var g1 = -1.2684380046 * ldt + 2.6097574011 * mdt - 0.3413193965 * sdt;
      var g2 = -1.2684380046 * ldt2 + 2.6097574011 * mdt2 - 0.3413193965 * sdt2;
      var ug = g1 / (g1 * g1 - 0.5 * g * g2);
      var tg = ug >= 0 ? -g * ug : Number.MAX_VALUE;
      var b  = -0.0041960863 * lv - 0.7034186147 * mv + 1.7076147010 * sv - 1;
      var b1 = -0.0041960863 * ldt - 0.7034186147 * mdt + 1.7076147010 * sdt;
      var b2 = -0.0041960863 * ldt2 - 0.7034186147 * mdt2 + 1.7076147010 * sdt2;
      var ub = b1 / (b1 * b1 - 0.5 * b * b2);
      var tb = ub >= 0 ? -b * ub : Number.MAX_VALUE;
      t += Math.min(tr, tg, tb);
    }
    return t;
  }

  function getStMid(a_, b_) {
    var S = 0.11516993 + 1 / (
      7.44778970 + 4.15901240 * b_
      + a_ * (-2.19557347 + 1.75198401 * b_
        + a_ * (-2.13704948 - 10.02301043 * b_
          + a_ * (-4.24894561 + 5.38770819 * b_ + 4.69891013 * a_)))
    );
    var T = 0.11239642 + 1 / (
      1.61320320 - 0.68124379 * b_
      + a_ * (0.40370612 + 0.90148123 * b_
        + a_ * (-0.27087943 + 0.61223990 * b_
          + a_ * (0.00299215 - 0.45399568 * b_ - 0.14661872 * a_)))
    );
    return [S, T];
  }

  function getCs(L, a_, b_) {
    var cusp = findCusp(a_, b_);
    var cMax = findGamutIntersection(a_, b_, L, 1, L, cusp);
    var stMax = [cusp[1] / cusp[0], cusp[1] / (1 - cusp[0])];
    var k = cMax / Math.min(L * stMax[0], (1 - L) * stMax[1]);
    var stMid = getStMid(a_, b_);
    var ca = L * stMid[0];
    var cb = (1 - L) * stMid[1];
    var cMid = 0.9 * k * Math.pow(1 / (1 / (ca * ca * ca * ca) + 1 / (cb * cb * cb * cb)), 0.25);
    var ca0 = L * 0.4;
    var cb0 = (1 - L) * 0.8;
    var c0 = Math.pow(1 / (1 / (ca0 * ca0) + 1 / (cb0 * cb0)), 0.5);
    return [c0, cMid, cMax];
  }

  function okhslToLinearSrgb(h, s, l) {
    if (l === 1) { return [1, 1, 1]; }
    if (l === 0) { return [0, 0, 0]; }
    var a_ = Math.cos(h * Math.PI / 180);
    var b_ = Math.sin(h * Math.PI / 180);
    var L = toeInv(l);
    var cs = getCs(L, a_, b_);
    var c0 = cs[0]; var cMid = cs[1]; var cMax = cs[2];
    var mid = 0.8; var midInv = 1.25;
    var C;
    if (s < mid) {
      var t = midInv * s;
      var k1 = mid * c0;
      var k2 = 1 - k1 / cMid;
      C = t * k1 / (1 - k2 * t);
    } else {
      var t = (s - mid) / (1 - mid);
      var k0 = cMid;
      var k1 = (1 - mid) * cMid * cMid * midInv * midInv / c0;
      var k2 = 1 - k1 / (cMax - cMid);
      C = k0 + t * k1 / (1 - k2 * t);
    }
    return oklabToLinearSrgb(L, C * a_, C * b_);
  }

  function linearToGamma(c) {
    if (c >= 0.0031308) { return 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
    return 12.92 * c;
  }

  function toHex(r, g, b) {
    function channel(c) {
      return Math.max(0, Math.min(255, Math.round(linearToGamma(c) * 255)))
        .toString(16).padStart(2, '0');
    }
    return '#' + channel(r) + channel(g) + channel(b);
  }

  // h ∈ [0, 360), s ∈ [0, 100], l ∈ [0, 100]
  function okhsl(h, s, l) {
    var rgb = okhslToLinearSrgb(h, s / 100, l / 100);
    return toHex(rgb[0], rgb[1], rgb[2]);
  }

  var SHADE_KEYS   = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  var SHADE_LIGHTS = [95,  85,  75,  65,  55,  45,  35,  25,  15,   5];
  var shadeRegistry = new Map();

  function makeScale(hues, s) {
    var scale = {};
    SHADE_KEYS.forEach(function (k, i) {
      var hex = okhsl(hues[i], s, SHADE_LIGHTS[i]);
      scale[k] = hex;
      shadeRegistry.set(hex, { scale: scale, key: k });
    });
    return scale;
  }

  // shade(hex, delta) — returns the colour delta shade-steps away in the same scale.
  // delta=-100 → one step brighter, delta=100 → one step darker.
  // Returns hex unchanged if the shifted key doesn't exist in the scale.
  function shade(hex, delta) {
    var entry = shadeRegistry.get(hex);
    if (!entry) { return hex; }
    var newKey = entry.key + delta;
    return entry.scale[newKey] !== undefined ? entry.scale[newKey] : hex;
  }

  function makeUniformScale(h, s) {
    return makeScale(SHADE_KEYS.map(function () { return h; }), s);
  }

  function makeCurvedScale(h, s, c) {
    return makeScale(SHADE_KEYS.map(function (k, i) { return h + (5 - i) * c; }), s);
  }

  // ─── Colour constants ─────────────────────────────────────────────────────────

  const red      = 29.23388519234265;
  // const red          = 22.524391836136154;
  const purple       = 273.39430507048314;
  const blue         = 259.67189104481287;
  const hue_dominant = purple;
  const hue_accent   = hue_dominant + 60;
  const curve        = 0;
  
  const grey      = makeUniformScale(hue_dominant, 5);
  const destruct = makeUniformScale(red, 100);
  // const destruct = makeUniformScale(red, 100);

  // ─────────────────────────────────────────────────────────────────────────────

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
    return span.textContent.split(/,|\s·\s/).map(function (s) { return slugify(s); }).filter(Boolean);
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
    const BASE_PX        = 4;
    const CHIP_GAP       = BASE_PX + 'px';        // space between chips within a row
    const ROW_GAP        = BASE_PX + 'px';        // space between rows within a group
    const MINI_GROUP_GAP = BASE_PX + 'px';  // extra top margin between sub-rows within a section
    const GROUP_GAP      = 2 * BASE_PX + 'px';    // extra top margin before each new group; total inter-group space = 2 × ROW_GAP

    const panel = document.createElement('div');
    panel.style.cssText = 'padding:4px 2px 6px;';

    // One shared grid — all rows share the same label column width.
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns:max-content 1fr; column-gap:4px; row-gap:' + ROW_GAP + '; color:var(--mono-6);';
    panel.appendChild(grid);

    function labelCell(text) {
      const el = document.createElement('div');
      el.style.cssText = 'display:flex; align-items:flex-start; padding-top:2px; font-size:11px; color:var(--mono-6); white-space:nowrap;';
      el.textContent = text;
      return el;
    }

    function boldLabelCell(text) {
      const el = labelCell(text);
      el.style.fontWeight = '700';
      return el;
    }

    function sectionLabelCell(text) {
      const el = boldLabelCell(text);
      el.style.fontSize = '0.95em';
      return el;
    }

    function subLabelCell(text) {
      const el = boldLabelCell(text);
      el.style.fontSize = '0.9em';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'flex-end';
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
        'cursor:pointer', 'font-size:0.8em', 'font-weight:400', 'padding:1px 6px 1px 4px',
        'border-radius:3px', 'user-select:none', 'border:1px solid currentColor',
        'transition:opacity 0.1s',
      ].join(';');
      const circle = document.createElement('span');
      circle.style.cssText = 'display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; transition:background 0.1s;';
      function refresh() {
        circle.style.background = getVal() ? grey[200] : 'transparent';
        circle.style.border     = '1px solid currentColor';
        chip.style.color        = getVal() ? grey[200] : grey[500];
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
        'cursor:pointer', 'font-size:0.8em', 'font-weight:400', 'padding:1px 6px 1px 4px',
        'border-radius:3px', 'user-select:none', 'border:1px solid currentColor',
        'transition:opacity 0.1s',
      ].join(';');
      const circle = document.createElement('span');
      circle.style.cssText = 'display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; transition:background 0.1s;';
      function refresh() {
        const excluded = excludedCategories.has(catName);
        circle.style.background = excluded ? destruct[300] : 'transparent';
        circle.style.border     = excluded ? `1px solid ${destruct[300]}` : '1px solid currentColor';
        chip.style.color        = excluded ? destruct[300] : grey[500];
        chip.style.border       = excluded ? `1px solid ${destruct[300]}` : '1px solid currentColor';
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
    grid.appendChild(sectionLabelCell('Release genres:'));
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
    const inflLabelCell = sectionLabelCell('Release influences:');
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
        'cursor:pointer', 'font-size:0.8em', 'font-weight:400', 'padding:1px 6px 1px 4px',
        'border-radius:3px', 'user-select:none', 'border:1px solid currentColor',
        'transition:opacity 0.1s',
      ].join(';');
      const circle = document.createElement('span');
      circle.style.cssText = 'display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; transition:background 0.1s;';
      function refresh() {
        const active = descriptorQty === value;
        circle.style.background = active ? grey[200] : 'transparent';
        circle.style.border     = '1px solid currentColor';
        chip.style.color        = active ? grey[200] : grey[500];
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
        'cursor:pointer', 'font-size:0.8em', 'font-weight:400', 'padding:1px 6px 1px 4px',
        'border-radius:3px', 'user-select:none', 'border:1px solid currentColor',
        'transition:opacity 0.1s',
      ].join(';');
      const circle = document.createElement('span');
      circle.style.cssText = 'display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; transition:background 0.1s;';
      function refresh() {
        circle.style.background = excludeParentDescs ? destruct[300] : 'transparent';
        circle.style.border     = excludeParentDescs ? `1px solid ${destruct[300]}` : '1px solid currentColor';
        chip.style.color        = excludeParentDescs ? destruct[300] : grey[500];
        chip.style.border       = excludeParentDescs ? `1px solid ${destruct[300]}` : '1px solid currentColor';
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

    // ── "Release descriptors" section header ──
    const descHeaderLabel = sectionLabelCell('Release descriptors:');
    descHeaderLabel.style.marginTop = GROUP_GAP;
    const descHeaderEmpty = bubbleCell([]);
    descHeaderEmpty.style.marginTop = GROUP_GAP;
    grid.appendChild(descHeaderLabel);
    grid.appendChild(descHeaderEmpty);

    // ── Include row (sub-row, indented label) ──
    const inclLabel = subLabelCell('Include:');
    inclLabel.style.paddingLeft = '8px';
    grid.appendChild(inclLabel);
    grid.appendChild(bubbleCell([chip8, chip12, chip16, chipAll]));

    // ── Exclude categories rows (populated async, indented label spanning 2 rows) ──
    const descLabelCell = subLabelCell('Exclude:');
    descLabelCell.style.gridRow = 'span 2';  // spans category chips row + omit-parents row
    descLabelCell.style.paddingLeft = '8px';
    descLabelCell.style.marginTop = MINI_GROUP_GAP;
    const descRow1 = bubbleCell([]);
    descRow1.style.marginTop = MINI_GROUP_GAP;
    const descRow2 = bubbleCell([makeExclParChip()]);

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
      topLevelCategories.forEach(function (cat) { descRow1.appendChild(makeDescChip(cat)); });
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
    const SETTINGS_OPEN_KEY = 'rym-rcb-settings-open';
    const settingsPanel = makeChartSettingsPanel();
    settingsPanel.style.display = localStorage.getItem(SETTINGS_OPEN_KEY) === 'true' ? 'block' : 'none';
    const settingsBtn = document.createElement('div');
    settingsBtn.className = 'more_btn';
    settingsBtn.textContent = '⚙';
    settingsBtn.style.cssText = 'line-height:27.6px; cursor:pointer;';
    settingsBtn.addEventListener('click', function () {
      const open = settingsPanel.style.display !== 'none';
      settingsPanel.style.display = open ? 'none' : 'block';
      try { localStorage.setItem(SETTINGS_OPEN_KEY, String(!open)); } catch (_) {}
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