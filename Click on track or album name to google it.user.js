// ==UserScript==
// @name         Click on track or album name to google it
// @version      0.3
// @description  Google searches for a track/album and artist when you click it on RYM
// @author       Jermrellum (modified by Helena S)
// @match        https://rateyourmusic.com/release/*
// @icon         https://www.google.com/s2/favicons?domain=rateyourmusic.com
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
  'use strict';

  // Global toggles for clickability
  const ENABLE_ALBUM_CLICKS = true;  // Set to false to disable album name clicks
  const ENABLE_TRACK_CLICKS = false;  // Set to false to disable track name clicks

  // Helper to encode URI, specifically handling "&amp;"
  function encodeURIAmp(str) {
      let eStr = encodeURI(str);
      eStr = eStr.replaceAll("&amp;", "%26");
      return eStr;
  }

  // 1) Grab the artist name as before
  let artistname = '';
  const artE = document.getElementsByClassName("artist")[0];
  if (artE) {
      if (artE.children.length > 0) {
          const spanA = artE.children[0].innerHTML;
          artistname = spanA.substring(1, spanA.length - 1);
      } else {
          artistname = artE.innerHTML;
      }
  }

  // 2) Make the album title clickable if enabled
  if (ENABLE_ALBUM_CLICKS) {
      const albumE = document.getElementsByClassName("album_title")[0];
      if (albumE) {
          const albumName = albumE.innerText.trim();
          const albumLink = "https://google.com/search?q="
              + encodeURIAmp(albumName) + " by "
              + encodeURIAmp(artistname);
//               + encodeURIAmp(artistname) + "+apple music";
          // Replace the text with a clickable link
          albumE.innerHTML = `<a href="${albumLink}" target="_blank">${albumName}</a>`;
      }
  }

  // 3) Make tracks clickable if enabled
  if (ENABLE_TRACK_CLICKS) {
      const tracksContainer = document.getElementById("tracks");
      if (!tracksContainer) return;

      const tracks = tracksContainer.children;
      let numToUse = 1;

      if (
          tracks[tracks.length - 1].children[0].children[1] === undefined
          || tracks[tracks.length - 1].children[0].children[1].children[0] === undefined
      ) {
          numToUse = 2;
      }

      let lenToUse = tracks.length;
      if (
          tracks[tracks.length - 1] === undefined
          || tracks[tracks.length - 1].children[0].children[numToUse] === undefined
      ) {
          lenToUse = tracks.length - 1;
      }

      for (let i = 0; i < lenToUse; i++) {
          numToUse = 1;
          if (
              tracks[i].children[0].children[1] === undefined
              || tracks[i].children[0].children[1].children[0] === undefined
          ) {
              numToUse = 2;
          }

          const tracknameElem = tracks[i].children[0].children[numToUse].children[0].children[0];
          if (!tracknameElem) continue 

          const trackname = tracknameElem.innerHTML;
          const link = "https://google.com/search?q="
              + encodeURIAmp(artistname) + "+"
              + encodeURIAmp(trackname);
            //   + encodeURIAmp(trackname) + "+apple music";

          tracknameElem.innerHTML = `<a href="${link}" target="_blank">${trackname}</a>`;
      }
  }
})();