// ==UserScript==
// @name         RYM Descriptor Propose Cancel
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Adds a "does not apply" (✗) button to the Propose bar on descriptor voting pages.
// @author       Helena S.
// @match        https://rateyourmusic.com/rdescriptor/set*
// @match        http://rateyourmusic.com/rdescriptor/set*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rateyourmusic.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function addDoesNotApplyButton() {
    const input = document.getElementById('prigen');
    if (!input) return;

    const form = input.closest('form');
    if (!form) return;

    const buttons = form.querySelectorAll('input[type="button"]');
    const lastBtn = buttons[buttons.length - 1];
    if (!lastBtn) return;

    // Clone the onclick of the ★ button to extract the voteDescriptor call,
    // then replicate it with polarity=-1 (does not apply) instead of polarity=1.
    // Signature: voteDescriptor(assoc_id, type, descriptor, track, polarity, degree, name)
    const starOnclick = buttons[0].getAttribute('onclick') || '';
    const argsMatch = starOnclick.match(/voteDescriptor\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),/);
    if (!argsMatch) return;

    const [, assocId, type, descriptor, track] = argsMatch;

    const notApply = document.createElement('input');
    notApply.type = 'button';
    notApply.value = '✗';
    notApply.title = 'Does not apply';
    notApply.onclick = function () {
      // polarity = -1, degree = 1
      window.voteDescriptor(
        Number(assocId),
        type.trim().replace(/['"]/g, ''),
        Number(descriptor),
        window.selectedTrack,
        -1,
        1,
        document.getElementById('prigen').value
      );
    };

    lastBtn.insertAdjacentElement('afterend', notApply);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDoesNotApplyButton);
  } else {
    addDoesNotApplyButton();
  }
})();
