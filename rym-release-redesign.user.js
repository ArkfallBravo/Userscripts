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
  const DEBUG      = true;
  const purple       = 273.39430507048314;
  const blue         = 259.67189104481287;
  const hue_dominant = blue;
  const hue_accent   = hue_dominant + 60;
  const curve        = 0;

  const grey_50  = okhsl(hue_dominant, 5, 95);
  const grey_100 = okhsl(hue_dominant, 5, 85);
  const grey_200 = okhsl(hue_dominant, 5, 75);
  const grey_300 = okhsl(hue_dominant, 5, 65);
  const grey_400 = okhsl(hue_dominant, 5, 55);
  const grey_500 = okhsl(hue_dominant, 5, 45);
  const grey_600 = okhsl(hue_dominant, 5, 35);
  const grey_700 = okhsl(hue_dominant, 5, 25);
  const grey_800 = okhsl(hue_dominant, 5, 15);
  const grey_900 = okhsl(hue_dominant, 5, 5);

  const primary_50  = okhsl(hue_dominant + 5 * curve, 85, 95);
  const primary_100 = okhsl(hue_dominant + 4 * curve, 85, 85);
  const primary_200 = okhsl(hue_dominant + 3 * curve, 85, 75);
  const primary_300 = okhsl(hue_dominant + 2 * curve, 85, 65);
  const primary_400 = okhsl(hue_dominant + 1 * curve, 85, 55);
  const primary_500 = okhsl(hue_dominant + 0 * curve, 85, 45);       // base
  const primary_600 = okhsl(hue_dominant - 1 * curve, 85, 35);
  const primary_700 = okhsl(hue_dominant - 2 * curve, 85, 25);
  const primary_800 = okhsl(hue_dominant - 3 * curve, 85, 15);
  const primary_900 = okhsl(hue_dominant - 4 * curve, 85,  5);

  const secondary_50  = okhsl(hue_dominant + 5 * curve, 45, 95);
  const secondary_100 = okhsl(hue_dominant + 4 * curve, 45, 85);
  const secondary_200 = okhsl(hue_dominant + 3 * curve, 45, 75);
  const secondary_300 = okhsl(hue_dominant + 2 * curve, 45, 65);
  const secondary_400 = okhsl(hue_dominant + 1 * curve, 45, 55);
  const secondary_500 = okhsl(hue_dominant + 0 * curve, 45, 45);       // base
  const secondary_600 = okhsl(hue_dominant - 1 * curve, 45, 35);
  const secondary_700 = okhsl(hue_dominant - 2 * curve, 45, 25);
  const secondary_800 = okhsl(hue_dominant - 3 * curve, 45, 15);
  const secondary_900 = okhsl(hue_dominant - 4 * curve, 45,  5);

  const tertiary_50  = okhsl(hue_accent + 5 * curve, 45, 95);
  const tertiary_100 = okhsl(hue_accent + 4 * curve, 45, 85);
  const tertiary_200 = okhsl(hue_accent + 3 * curve, 45, 75);
  const tertiary_300 = okhsl(hue_accent + 2 * curve, 45, 65);
  const tertiary_400 = okhsl(hue_accent + 1 * curve, 45, 55);
  const tertiary_500 = okhsl(hue_accent + 0 * curve, 45, 45);       // base
  const tertiary_600 = okhsl(hue_accent - 1 * curve, 45, 35);
  const tertiary_700 = okhsl(hue_accent - 2 * curve, 45, 25);
  const tertiary_800 = okhsl(hue_accent - 3 * curve, 45, 15);
  const tertiary_900 = okhsl(hue_accent - 4 * curve, 45,  5);

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



  // ─── OKHSL → HEX ─────────────────────────────────────────────────────────
  // Exact conversion per Björn Ottosson's reference implementation.
  // Chain: okhsl → okhslToLinearSrgb → [computeMaxSaturation → findCusp →
  //        findGamutIntersection → getCs] → oklabToLinearSrgb → linearToGamma → toHex
  // Usage: okhsl(h, s, l) — h ∈ [0, 360), s ∈ [0, 100], l ∈ [0, 100]
  // Returns a CSS hex string e.g. "#2a5298".

  // Direct port of ColorMath.swift (Björn Ottosson, MIT licence).

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
    // h is in degrees; Swift reference uses h in [0,1] turns with cos(2π·h)
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
    const rgb = okhslToLinearSrgb(h, s / 100, l / 100);
    return toHex(rgb[0], rgb[1], rgb[2]);
  }

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
      border: 2px solid ${primary_200} !important;
      // background: color-mix(in srgb, ${primary_400} 25%, transparent) !important;
      color: ${primary_200} !important;
      font-size: ${font_size_base}px !important;
      font-weight: ${font_weight_normal} !important;
    }
    .release_sec_genres a.genre {
      border: 1px solid ${grey_300} !important;
      // background: color-mix(in srgb, ${grey_500} 25%, transparent) !important;
      font-size: ${font_size_sm}px !important;
      color: ${grey_300} !important;
      font-weight: ${font_weight_normal} !important;
    }
    .release_movement_genres a.genre {
      background: transparent !important;
      border: 0px solid ${primary_400} !important;
      color: ${primary_200} !important;
      font-size: ${font_size_base}px !important;
      font-weight: ${font_weight_normal} !important;
    }

    /* Secondary genres on their own line */
    .release_pri_genres + br { display: none !important; }
    .release_sec_genres { display: block !important; margin-top: 4px !important; }

    /* ── Album info table ───────────────────────── */
    th.info_hdr {
      font-size: ${font_size_sm}px !important;
      color: ${grey_400} !important;
      font-weight: ${font_weight_normal} !important;
    }
    .album_title a {
      font-size: ${font_size_3xl}px !important;
      color: ${grey_50} !important;
    }
    table.album_info,
    table.album_info td {
      font-size: ${font_size_base}px !important;
      color: ${grey_100} !important;
    }
    table.album_info a {
      font-size: ${font_size_base}px !important;
      color: ${primary_200} !important;
      font-weight: ${font_weight_normal} !important;
    }
    table.album_info b {
      font-size: ${font_size_base}px !important;
      color: ${grey_100} !important;
      font-weight: ${font_weight_bold} !important;
    }
    .avg_rating {
      font-size: ${font_size_xl}px !important;
      font-weight: ${font_weight_bold} !important;
    }
    .avg_rating_friends {
      font-size: ${font_size_base}px !important;
      color: ${tertiary_200} !important;
      font-weight: ${font_weight_normal} !important;
    }
    .max_rating {
      font-size: ${font_size_base}px !important;
      color: ${grey_300} !important;
    }
    .num_ratings {
      font-size: ${font_size_sm}px !important;
      color: ${grey_300} !important;
    }

    /* ── Descriptor text ─────────────────────────── */
    .release_pri_descriptors {
      font-size: ${font_size_sm}px !important;
      color: ${grey_200} !important;
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
