// ==UserScript==
// @name         RYM: Make release title clickable (Google search)
// @version      0.2
// @match        https://rateyourmusic.com/release/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  window.addEventListener('load', () => {
    const albumTitleDiv = document.querySelector('.album_title');
    if (!albumTitleDiv) return;

    // Find the text node that actually contains the title
    let titleNode = null;
    for (const node of albumTitleDiv.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "") {
        titleNode = node;
        break;
      }
    }
    if (!titleNode) return;

    const albumName = titleNode.textContent.trim();

    // Locate artist name (matches your uploaded page)
    const artistEl =
      albumTitleDiv.querySelector('.album_artist_small .artist') ||
      document.querySelector('.album_info .artist') ||
      albumTitleDiv.querySelector('.artist');

    if (!artistEl) return;
    const artistName = artistEl.textContent.trim();

    const url =
      'https://www.google.com/search?q=' +
      encodeURIComponent(`${albumName} by ${artistName}`);

    // Build new link
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.textContent = albumName;

    // Replace the text node with the link
    albumTitleDiv.replaceChild(link, titleNode);
  });

})();