// ==UserScript==
// @name         RYM Next Page Keybind
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Press Option+. to click the next button on RYM
// @match        *://rateyourmusic.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    document.addEventListener('keydown', function(e) {
        // Check for Option+. (Alt+. on most keyboards)
        if (e.optKey && !e.shiftKey && !e.ctrlKey && !e.metaKey && e.key === '.') {
            e.preventDefault();

            const nextBtn = document.querySelector('a.navlinknext');
            if (nextBtn) {
                nextBtn.click();
            }
        }
    });
})();