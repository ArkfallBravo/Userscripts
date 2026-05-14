// // ==UserScript==
// // @name         RYM Weighted Average
// // @namespace    http://tampermonkey.net/
// // @version      0.1
// // @description  Calculates and displays a weighted average for RYM releases using a custom formula
// // @author       You
// // @match        https://rateyourmusic.com/release/*
// // @icon         https://www.google.com/s2/favicons?sz=64&domain=rateyourmusic.com
// // @grant        none
// // ==/UserScript==

// (function() {
//   'use strict';

//   setTimeout(() => {
//     const chartDiv = document.getElementById('chart_div');
//     if (!chartDiv) return console.log('Chart div not found');

//     // 1) Find the <script> immediately after #chart_div
//     const js = Array.from(document.querySelectorAll('#chart_div + script'))
//                     .map(s => s.textContent)
//                     .find(t => t.includes('addRows'));
//     if (!js) return console.log('Couldn’t find addRows script');

//     // 2) Extract that big array literal
//     const match = js.match(/addRows\(\s*\[\s*([\s\S]*?)\]\s*\)/);
//     if (!match) return console.log('addRows pattern not matched');

//     // 3) Turn it into a JS array of [rating, count]
//     const rows = match[1]
//       .split(/\],\s*\[/)
//       .map(s => s.replace(/[\[\]]/g,'').split(',').map(Number));
//     // -> [[0.5,18], [1.0,29], …, [5.0,149]]
        
//         // Define the weight values for each star rating
//         const weights = {
//             5: 25,    // 5 stars = 25
//             4.5: 20.25, // 4.5 stars = 20.25
//             4: 16,    // 4 stars = 16
//             3.5: 12.25, // 3.5 stars = 12.25
//             3: 9,     // 3 stars = 9
//             2.5: 6.25, // 2.5 stars = 6.25
//             2: 4,     // 2 stars = 4
//             1.5: 2.25, // 1.5 stars = 2.25
//             1: 1,     // 1 star = 1
//             0.5: 0.25  // 0.5 stars = 0.25
//         };
        
//         // Calculate weighted sum
//         let weightedSum = 0;
//         rows.forEach(([rating, count]) => {
//           weightedSum += (weights[rating] || 0) * count;
//         });
        
//         // Calculate weighted average and square root
//         const weightedAverage = Math.sqrt(weightedSum / totalRatings);
        
//         // Display the result
//         numRatingsElement.innerHTML += ' (' + weightedAverage.toFixed(2) + ')';
//     }, 1000);
// })(); 

// ==UserScript==
// @name     RYM Weighted Average (fixed)
// @match    https://rateyourmusic.com/release/*
// ==/UserScript==
(function() {
  'use strict';
  setTimeout(() => {
    // 1) grab the script that calls data.addRows([...])
    const js = Array.from(document.querySelectorAll('#chart_div + script'))
      .map(s => s.textContent)
      .find(t => t.includes('addRows'));
    if (!js) return console.log('No addRows script');

    // 2) extract the array literal
    const m = js.match(/addRows\(\s*\[\s*([\s\S]*?)\]\s*\)/);
    if (!m) return console.log('Pattern not matched');

    // 3) build rows = [[rating, count], …]
    const rows = m[1]
      .split(/\],\s*\[/)
      .map(s => s.replace(/[\[\]]/g,'').split(',').map(Number));

    // 4) define your weights
    const weights = {5:25,4.5:20.25,4:16,3.5:12.25,3:9,2.5:6.25,2:4,1.5:2.25,1:1,0.5:0.25};

    // 5) compute weighted sum
    let weightedSum = 0;
    rows.forEach(([rating,count]) => {
      weightedSum += (weights[rating] || 0) * count;
    });

    // 6) pull the real total from the “Ratings:” line
    const info = document.getElementById('rating_info_ratings');
    const totalRatings = Number(info.textContent.replace(/[^0-9]/g,''));

    // 7) compute & display
    const avg = Math.sqrt(weightedSum / totalRatings);
    info.innerHTML += ` (<b>${avg.toFixed(2)}</b>)`;
    console.log('Weighted average:', avg.toFixed(2));
  }, 1000);
})();