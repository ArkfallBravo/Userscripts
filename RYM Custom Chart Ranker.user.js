// ==UserScript==
// @name         RYM Custom Chart Ranker
// @namespace    https://example.com
// @version      0.1
// @description  Append (#1), (#2), etc. to each average rating in a custom chart
// @match        https://rateyourmusic.com/charts/*
// @grant        none
// ==/UserScript==

(function() {
  // Wait until the page is loaded
  window.addEventListener('load', () => {
    // 1) Select each chart item container.
    //    These appear to have the class "page_charts_section_charts_item".
    const items = Array.from(document.querySelectorAll('.page_charts_section_charts_item'));

    if (!items.length) {
      console.log("No chart items found. Check the selector.");
      return;
    }

    // 2) For each item, find the average rating number (e.g. "4.28") inside
    //    <span class="page_charts_section_charts_item_details_average_num">4.28</span>
    const data = [];
    for (const item of items) {
      const ratingElem = item.querySelector('.page_charts_section_charts_item_details_average_num');
      if (!ratingElem) continue;

      // e.g. "4.28"
      const ratingText = ratingElem.textContent.trim();
      const ratingVal = parseFloat(ratingText);
      if (isNaN(ratingVal)) continue;

      data.push({ item, ratingVal, ratingElem });
    }

    // 3) Sort by rating (descending)
    data.sort((a, b) => b.ratingVal - a.ratingVal);

    // 4) Loop through sorted array and rewrite each rating text to include rank
    data.forEach((entry, index) => {
      const rank = index + 1;
      // If the text was "4.28", rewrite to "4.28 (#1)"
      entry.ratingElem.textContent = `${entry.ratingVal.toFixed(2)} (#${rank})`;
    });

    console.log("Done ranking custom chart items!");
  });
})();