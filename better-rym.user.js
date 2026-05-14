// ==UserScript==
// @name         RYM Stream Links
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Inject streaming-service icons/links into RateYourMusic release pages
// @match        https://rateyourmusic.com/release/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
  'use strict';

  // Create a <script type="module"> so that the page’s own modules (imports)
  // still resolve relative to the site’s URL.
  const moduleScript = document.createElement('script');
  moduleScript.type = 'module';
  moduleScript.textContent = `

// ———————————————————————————————————————————————————————————————————————————————
// BEGIN inlined contents of main-bRo0Ke9k.js  [oai_citation:0‡main-bRo0Ke9k.js](file-service://file-VRvF2LD4TrAafLTVMemcGZ)
// ———————————————————————————————————————————————————————————————————————————————

import { r as I, p as $ } from "./././pages-l-F-sH4c.js";
import { u as c, B as x } from "./././jsxRuntime.module-BWwiB_fU.js";
import { w as u, b as C, r as j } from "./././dom-CobwuVJs.js";
import { h as _, q as v, y as h } from "./././hooks.module-DXOsBjtv.js";
import { j as m, n as k, k as L, F, i as P, l as g, a as y, c as d, S as E, o as O } from "./././failed-B0iS6eRP.js";
import { L as H } from "./././loader-B6V6MbqX.js";
import "./././codec-BoQKq8nu.js";
import "./././types-APkctDvO.js";
import "./././fetch-C4kZ4Uao.js";

const M = t => t instanceof Error
  ? t
  : typeof t === "string"
    ? new Error(t)
    : new Error(String(t));

function A({ service: t, state: e }) {
  const [hover, setHover] = _(false),
        icon = v(() => {
          if (m(e) && e.data._tag === "exists")  return t.icon({ style: { ...f, ...hover ? w : b } });
          if (m(e) && e.data._tag === "found")   return t.foundIcon({ style: { ...f, ...hover ? w : b } });
                                                  return t.notFoundIcon({ style: { ...f, ...T } });
        }, [t, e, hover]);

  return c("div", {
    style: { position: "relative" },
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    children: [
      icon(),
      k(e) && c(H, { style: S }),
      L(e) && c(F, { error: e.error, style: S })
    ]
  });
}

const f = { color: "var(--mono-3)", transition: "opacity 0.2s" },
      b = { opacity: .8 },
      w = { opacity: 1 },
      T = { opacity: .15 },
      S = { position: "absolute", right: 0, bottom: 0, width: 16, height: 16 };

function q({ service: t, pageData: e }) {
  const [pageState, setPageState] = _(P);

  h(() => {
    (async () => {
      if    (k(e))         setPageState(g);
      else if (L(e))       setPageState(y(e.error));
      else if (m(e)) {
        const { id } = t,
              url = e.data.links[id];
        if (url == null) {
          setPageState(g);
          try {
            const found = await t.search(e.data.metadata);
            setPageState(found == null
              ? d({ _tag: "not-found" })
              : d({ _tag: "found", url: found }));
          } catch (err) {
            setPageState(y(M(err)));
          }
        } else {
          setPageState(d({ _tag: "exists", url }));
        }
      }
    })();
  }, [e, t]);

  const iconElem = v(() => c(A, { service: t, state: pageState }), [t, pageState]);

  return (m(pageState) && (pageState.data._tag === "exists" || pageState.data._tag === "found"))
    ? c("a", { href: pageState.data.url, target: "_blank", rel: "noreferrer", children: iconElem() })
    : iconElem();
}

const B = () => {
  const [serviceReady, setServiceReady] = _(P),
        loadAll = async () => {
          setServiceReady(g);
          try {
            const result = await N();
            setServiceReady(d(result));
          } catch (err) {
            setServiceReady(y(M(err)));
          }
        };

  h(() => { O(serviceReady) && loadAll(); }, [serviceReady]);
  return serviceReady;
};

async function N() {
  const [artist, title, links] = await Promise.all([ R(), J(), K() ]);
  return { metadata: { artist, title }, links };
}

async function R() { return (await u("a.artist")).text; }
async function J() { return (await u("meta[itemprop=name]")).content; }

async function K() {
  await C();
  const prefs = await Y();
  if (!prefs) return p;
  const container = document.querySelector("#media_link_button_container_top");
  if (!container) return p;
  const raw = container.dataset.links;
  if (!raw) return p;

  const parsed = JSON.parse(raw),
        mapped = Object.fromEntries(Object.entries(parsed).map(([svc, data]) => {
          const best  = z(svc, data, prefs),
                link  = best ? G(svc, best) : void 0;
          return [svc, link];
        }));

  return Object.fromEntries(E.map(({ id }) => [ id, mapped[id] ]));
}

const p = Object.fromEntries(E.map(({ id }) => [ id, void 0 ]));

const Y = async () => new Promise(resolve => {
  const handler = e => {
    document.removeEventListener("StreamingPreferencesEvent", handler);
    resolve(e.detail.streamingPreferences);
  };
  document.addEventListener("StreamingPreferencesEvent", handler);
  j(\`
    const prefs = window.streamingPreferences;
    document.dispatchEvent(new CustomEvent('StreamingPreferencesEvent', { detail: { streamingPreferences: prefs }}));
  \`);
});

function z(svc, data, prefs) {
  let fallback = null, fallbackKey = null;
  for (const [key, cfg] of Object.entries(data)) {
    if ("default" in cfg) {
      fallback    = cfg;
      fallbackKey = key;
    } else if (cfg.for?.includes(prefs.service_regions[svc])) {
      cfg.media_id = key;
      return cfg;
    }
  }
  // if no region-match, return default unless blocked
  if (fallback && !(fallback.not?.includes(prefs.service_regions[svc]))) {
    fallback.media_id = fallbackKey;
    return fallback;
  }
  return null;
}

function G(svc, info) {
  switch (svc) {
    case "spotify":     return \`https://open.spotify.com/\${info.type}/\${info.media_id}\`;
    case "applemusic":  return \`https://geo.music.apple.com/\${info.loc}/\${info.album?"album":"video"}/\${info.media_id}\`;
    case "soundcloud":  return \`https://\${info.url}\`;
    case "bandcamp":    return \`https://\${info.url}\`;
    case "youtube":     return \`https://www.youtube.com/watch?v=\${info.media_id}\`;
    default: throw new Error(\`Unknown service: \${svc}\`);
  }
}

function Q() {
  h(() => {
    const style = document.createElement("style");
    style.textContent = \`
      #media_link_button_container_top { display: none; }
    \`;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return c("div", {
    style: { display: "flex", gap: 4, alignItems: "center", justifyContent: "center", marginTop: "1.5em" },
    children: E.map(e => c(q, { service: e, pageData: B() }, e.id))
  });
}

const U = async () => {
  const container = document.createElement("div");
  container.id = "better-rym";
  try {
    (await u('.hide-for-small a[href^="buy"]')).after(container);
  } catch {
    (await u(".page_release_art_frame .hide-for-small")).prepend(container);
  }
  x(c(Q, {}), container);
};

// finally, hook into RYM’s built-in event bus:
I($.streamLinks, () => { U(); });

// ———————————————————————————————————————————————————————————————————————————————
// END inlined contents of main-bRo0Ke9k.js
// ———————————————————————————————————————————————————————————————————————————————

  `;
  document.head.appendChild(moduleScript);
})();