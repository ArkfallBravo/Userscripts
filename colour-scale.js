// colour-scale.js
// okhsl → hex conversion (Björn Ottosson, MIT licence) + shade scale infrastructure.
// Loaded via @require in Tampermonkey; exposes globals: okhsl, makeUniformScale,
// makeCurvedScale, shade.

(function (global) {
  'use strict';

  // ─── OKHSL → HEX ─────────────────────────────────────────────────────────────

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

  // ─── SHADE SCALE INFRASTRUCTURE ──────────────────────────────────────────────

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

  global.okhsl            = okhsl;
  global.shade            = shade;
  global.makeUniformScale = makeUniformScale;
  global.makeCurvedScale  = makeCurvedScale;

}(typeof unsafeWindow !== 'undefined' ? unsafeWindow : window));
