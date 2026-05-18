// ==UserScript==
// @name         RYM Descriptor Propose Cancel
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  Adds a "does not apply" button to the Propose bar on descriptor voting pages.
// @author       Helena S.
// @match        https://rateyourmusic.com/rdescriptor/set*
// @match        http://rateyourmusic.com/rdescriptor/set*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rateyourmusic.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const log = (...args) => console.log('[ebr-propose-cancel]', ...args);
  log('script loaded, url:', window.location.href, 'readyState:', document.readyState);

  // ── Add the does-not-apply button ───────────────────────────────────────────
  function addBanButton() {
    log('addBanButton called');
    const input = document.getElementById('prigen');
    log('  #prigen input:', input);
    if (!input) return;
    const form = input.closest('form');
    log('  form:', form);
    if (!form) return;

    const existingBtns = form.querySelectorAll('input[type="button"]');
    log('  existing input[type=button] count:', existingBtns.length, existingBtns);
    if (!existingBtns.length) return;

    // Bail if we've already added it (in case init runs twice)
    if (form.querySelector('[data-ebr-ban]')) { log('  already added, skipping'); return; }

    // Extract the assoc ID from the first ★ button's onclick.
    // The onclick looks like: voteDescriptor(13593326, 'l', 0, selectedTrack, 1, 1, did('prigen').value);
    const firstOnclick = existingBtns[0].getAttribute('onclick') || '';
    const assocMatch = firstOnclick.match(/voteDescriptor\(\s*(\d+)/);
    const assocId = assocMatch ? assocMatch[1] : '0';

    // Build the ban button as a <button class="ui_button voting"> with a fa-ban icon.
    // Parsing via innerHTML binds the inline onclick to the page's main world
    // (where voteDescriptor and did() are defined) — setAttribute('onclick', ...)
    // doesn't reliably do that under Safari Userscripts.
    const banHtml = `<button type="button" class="ui_button  voting" value="-" data-ebr-ban="1" title="Does not apply" `
      + `onclick="voteDescriptor(${assocId}, 'l', 0, selectedTrack, -1, 0, did('prigen').value);">`
      + `<i class="fa fa-ban"></i></button>`;

    const tmp = document.createElement('div');
    tmp.innerHTML = banHtml;
    const banButton = tmp.firstElementChild;

    existingBtns[existingBtns.length - 1].insertAdjacentElement('afterend', banButton);

    // Copy visual styles from an existing propose-bar button so the <button>
    // element matches the <input type="button"> elements around it.
    const refStyle = window.getComputedStyle(existingBtns[0]);
    ['background', 'backgroundColor', 'color', 'border', 'borderRadius',
     'padding', 'fontSize', 'fontFamily', 'height', 'lineHeight', 'cursor',
     'verticalAlign', 'boxSizing'].forEach(function (prop) {
      banButton.style[prop] = refStyle[prop];
    });

    log('  ⊘ button inserted, html:', banButton.outerHTML);
  }

  // ── Init: try now, and also watch for the form to appear ───────────────────
  function init() {
    log('init() called, readyState:', document.readyState);
    addBanButton();

    // Fallback: if the form/buttons load later, watch for them
    if (!document.querySelector('[data-ebr-ban]')) {
      log('button not yet added, setting up MutationObserver');
      const obs = new MutationObserver(() => {
        if (document.getElementById('prigen') && !document.querySelector('[data-ebr-ban]')) {
          addBanButton();
          if (document.querySelector('[data-ebr-ban]')) {
            log('button added via MutationObserver, disconnecting');
            obs.disconnect();
          }
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      // Give up after 10 seconds
      setTimeout(() => { obs.disconnect(); log('MutationObserver disconnected (timeout)'); }, 10000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
