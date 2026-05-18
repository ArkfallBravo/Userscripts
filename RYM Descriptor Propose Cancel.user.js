// ==UserScript==
// @name         RYM Descriptor Propose Cancel
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Adds a "does not apply" button to the Propose bar on descriptor voting pages, and reflects existing vote state when the typed descriptor is already voted.
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

  let proposeButtons = [];  // { btn, polarity, degree }
  let banButton = null;

  function getAlbumId() {
    const el = document.querySelector('[id^="descriptorList"]');
    return el ? el.id.replace('descriptorListl', '') : '';
  }

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
    banButton = tmp.firstElementChild;

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

    // Register all propose buttons for highlight tracking
    proposeButtons = [
      { btn: existingBtns[0], polarity:  1, degree: 1 },
      { btn: existingBtns[1], polarity:  1, degree: 2 },
      { btn: existingBtns[2], polarity:  1, degree: 3 },
      { btn: banButton,       polarity: -1, degree: 0 },
    ];

    // Watch input for vote-state reflection
    input.addEventListener('input', () => updateHighlight(input.value));
  }

  // ── Find vote state for a descriptor name in the loaded list ────────────────
  function findVoteState(name) {
    if (!name.trim()) return null;
    const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const listEl = document.getElementById('descriptorListl' + getAlbumId());
    if (!listEl) return null;

    for (const row of listEl.querySelectorAll('tr')) {
      const nameEl = row.querySelector('a.descriptor, b, strong, td:first-child a');
      if (!nameEl || norm(nameEl.textContent) !== norm(name)) continue;

      // A "cancel" button in the row signals the user has voted
      const cancelEl = Array.from(row.querySelectorAll('input[type="button"], button'))
        .find(b => (b.value || b.textContent).trim().toLowerCase() === 'cancel');
      if (!cancelEl) return { voted: false };

      // Find which vote button is highlighted (active/selected class or style difference)
      const votedBtn = Array.from(row.querySelectorAll('button.ui_button.voting'))
        .find(b => b.classList.contains('active') || b.classList.contains('selected') ||
                   b.getAttribute('aria-pressed') === 'true');

      if (!votedBtn) return { voted: true, polarity: null, degree: null };

      if (votedBtn.querySelector('.fa-ban')) return { voted: true, polarity: -1, degree: 0 };
      const stars = (votedBtn.textContent.trim().match(/★/g) || []).length;
      return { voted: true, polarity: 1, degree: stars };
    }
    return null;
  }

  // ── Highlight propose bar buttons to reflect current vote ───────────────────
  function updateHighlight(value) {
    proposeButtons.forEach(({ btn }) => btn.style.outline = '');

    const state = findVoteState(value);
    if (!state || !state.voted || state.polarity === null) return;

    proposeButtons.forEach(({ btn, polarity, degree }) => {
      if (polarity === state.polarity && degree === state.degree) {
        btn.style.outline = '2px solid var(--primary, #207bbf)';
      }
    });
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
