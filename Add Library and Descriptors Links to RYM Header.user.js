// ==UserScript==
// @name         Add Library and Descriptors Links to RYM Header
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Insert "descriptors" between "genres" and "charts" and "library" between "charts" and "lists" in the RYM header
// @match        https://rateyourmusic.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const DESCRIPTOR_HREF = '/music_descriptor/';
  const LIB_HREF        = '/charts/top/album,ep,comp,single,video,unauth,mixtape,musicvideo,djmix,additional/all-time/u:ArkfallOverfall/incl:live,archival,soundtrack/';

  function insertLinks() {
    const genresLink = document.querySelector('a.header_item[href="/genres/"], a.header_charts.header_item[href="/genres/"]');
    const chartsLink = document.querySelector('a.header_item[href="/charts/"], a.header_charts.header_item[href="/charts/"]');
    const listsLink  = document.querySelector('a.header_item[href="/lists/"]');

    if (!chartsLink || !listsLink) return false; // cannot place either without these
    // "descriptors" only needs genres+charts; "library" needs lists

    // Insert "descriptors" before charts
    const aDesc = document.createElement('a');
    aDesc.className = 'header_item';
    aDesc.href = DESCRIPTOR_HREF;
    aDesc.textContent = 'descriptors';
    chartsLink.parentNode.insertBefore(aDesc, chartsLink);

    // Insert "library" before lists
    const aLib = document.createElement('a');
    aLib.className = 'header_item';
    aLib.href = LIB_HREF;
    aLib.textContent = 'library';
    listsLink.parentNode.insertBefore(aLib, listsLink);

    return true;
  }

  if (insertLinks()) return;

  const obs = new MutationObserver(() => {
    if (insertLinks()) obs.disconnect();
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();