// ----------------------------------------------------------------------- //
//
// MODULE  : RYM Set Listening as Date Tag.user.js
//
// PURPOSE : Replaces RYM's "Set Listening" button with a date-tagging one
//
// CREATED : 5/14/2026
//
// ----------------------------------------------------------------------- //

// ==UserScript==
// @name         RYM Set Listening as Date Tag
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Replaces the "Set Listening" button with one that appends today's date to the release's tags.
// @author       lillyanasimson
// @match        https://rateyourmusic.com/release/*
// @match        http://rateyourmusic.com/release/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rateyourmusic.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const US_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const DASHED_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

  // Returns a zero-padded yyyy-mm-dd string.
  function formatIsoDate(year, month, day)
  {
    return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  function todayTag()
  {
    const d = new Date();
    return formatIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  // Converts an m/d/yyyy or yyyy-m-d tag to yyyy-mm-dd; returns any other tag unchanged.
  function toIsoTag(tag)
  {
    const usMatch = tag.match(US_DATE_PATTERN);
    if (usMatch)
    {
      return formatIsoDate(usMatch[3], usMatch[1], usMatch[2]);
    }
    const dashedMatch = tag.match(DASHED_DATE_PATTERN);
    if (dashedMatch)
    {
      return formatIsoDate(dashedMatch[1], dashedMatch[2], dashedMatch[3]);
    }
    return tag;
  }

  function addDateTag() {
    const input = document.querySelector('input.tag_tags');
    if (!input) return;

    const dateStr = todayTag();
    const converted = input.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean).map(toIsoTag);
    const existing = Array.from(new Set(converted));

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
