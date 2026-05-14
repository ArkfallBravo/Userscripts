// ==UserScript==
// @name         RYM Expand All Genres
// @namespace    https://rateyourmusic.com/
// @version      0.2
// @description  Force all genre sections open on RYM without collapsing others
// @match        https://rateyourmusic.com/genres/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
  "use strict";

  function expandAll() {
    // Each item has an "expanded" div like id="page_genre_index_hierarchy_item_expanded_84"
    document.querySelectorAll(".page_genre_index_hierarchy_item_expanded").forEach(div => {
      div.style.display = "block";        // ensure visible
      div.style.maxHeight = "none";       // remove any collapsed constraints
      div.style.opacity = "1";            // prevent fade effects hiding it
    });

    // Make sure the “expanded” text shows correctly
    document.querySelectorAll(".page_genre_index_hierarchy_item_expand .expanded").forEach(span => {
      span.style.display = "inline";
    });
    document.querySelectorAll(".page_genre_index_hierarchy_item_expand .not_expanded").forEach(span => {
      span.style.display = "none";
    });
  }

  // Run once DOM settles
  const interval = setInterval(() => {
    expandAll();
  }, 500);

  // Stop after ~10 seconds
  setTimeout(() => clearInterval(interval), 10000);
})();