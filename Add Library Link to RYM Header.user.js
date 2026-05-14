// ==UserScript==
// @name         Add Library Link to RYM Header
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Insert "library" between "charts" and "lists" in the RYM header
// @match        https://rateyourmusic.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const LIB_HREF = '/charts/top/album,ep,comp,single,video,unauth,mixtape,musicvideo,djmix,additional/all-time/u:ArkfallOverfall/incl:live,archival,soundtrack/';

  function insertOnce() {
    const genresLink = document.querySelector('a.header_item[href="/genres/"], a.header_charts.header_item[href="/genres/"]');
    const chartsLink = document.querySelector('a.header_item[href="/charts/"], a.header_charts.header_item[href="/charts/"]');
    const listsLink  = document.querySelector('a.header_item[href="/lists/"]');

    if (!chartsLink || !listsLink) return;

    // prevent duplicates
    if (document.querySelector(`a.header_item[href="${LIB_HREF}"]`)) return;

    const a = document.createElement('a');
    a.className = 'header_item';
    a.href = LIB_HREF;
    a.textContent = 'library';

    // Insert before "lists" using its parent
//     listsLink.parentNode.insertBefore(a, listsLink);
    chartsLink.parentNode.insertBefore(a, chartsLink);
    return true;
  }

  // Try immediately
  if (insertOnce()) return;

  // Observe for SPA/delayed header render
  const obs = new MutationObserver(() => {
    if (insertOnce()) obs.disconnect();
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();