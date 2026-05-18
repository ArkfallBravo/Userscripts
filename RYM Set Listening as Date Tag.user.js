// ==UserScript==
// @name         RYM Set Listening as Date Tag
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Replaces the "Set Listening" button with one that appends today's date to the release's tags.
// @author       lillyanasimson
// @match        https://rateyourmusic.com/release/*
// @match        http://rateyourmusic.com/release/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rateyourmusic.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function todayTag() {
    const d = new Date();
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
  }

  function addDateTag() {
    const input = document.querySelector('input.tag_tags');
    if (!input) return;

    const dateStr = todayTag();
    const existing = input.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);

    if (!existing.includes(dateStr)) existing.push(dateStr);
    if (!existing.includes('dated')) existing.push('dated');
    input.value = existing.join(', ');

    if (typeof window.tags !== 'undefined' && typeof window.tags.save === 'function') {
      window.tags.save();
    } else {
      const saveLink = document.querySelector('a.tag_save');
      if (saveLink) saveLink.click();
    }
  }

  function init() {
    const btn = document.getElementById('listening_btn');
    if (!btn) return;

    btn.textContent = 'Set Listening';
    btn.onclick = function () { addDateTag(); };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
