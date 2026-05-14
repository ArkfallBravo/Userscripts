// ==UserScript==
// @name         RYM 5 star ratio
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Displays the ratio of 5 star ratings on an album.
// @author       You
// @match        https://rateyourmusic.com/release/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rateyourmusic.com
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/473783/RYM%205%20star%20ratio.user.js
// @updateURL https://update.greasyfork.org/scripts/473783/RYM%205%20star%20ratio.meta.js
// ==/UserScript==

(function() {
    'use strict';
    setTimeout(() => {
        const numRatingsElement = document.querySelector('.num_ratings');
        const totalRatings = Number(document.querySelector('.num_ratings span').innerText.replace(/,/g, ''));
        const chartDiv = document.getElementById('chart_div');
        const tdElements = chartDiv.querySelectorAll('td');
        const fiveStarRatings = Number(tdElements[tdElements.length - 1].innerText.replace(/,/g, ''));
        const calculatedValue = fiveStarRatings / totalRatings * 100;
        numRatingsElement.innerHTML += ' (' + calculatedValue.toFixed(2) + '%)';
    }, 1000);

    console.log('hello');
})();