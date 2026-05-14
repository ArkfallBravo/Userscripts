// ==UserScript==
// @name         RYM Release Comparison Tool
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Compare two RYM release pages and display overlapping and unique elements
// @author       Helena S.
// @match        https://rateyourmusic.com/release/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Function to extract elements from a release page
    function extractElements() {
        const elements = {
            descriptors: [],
            genres: [],
            influences: [],
            releaseName: '',
            artistName: ''
        };

        // Extract release and artist names from the media link container
        const mediaContainer = document.querySelector('.media_link_container');
        if (mediaContainer) {
            elements.releaseName = mediaContainer.getAttribute('data-albums') || '';
            elements.artistName = mediaContainer.getAttribute('data-artists') || '';
        }

        // Extract descriptors from the primary descriptors span
        const descriptorsSpan = document.querySelector('.release_pri_descriptors');
        if (descriptorsSpan) {
            elements.descriptors = descriptorsSpan.textContent
                .split(',')
                .map(d => d.trim())
                .filter(d => d);
        }

        // Extract primary genres (the main genres)
        const genreText = document.querySelector('.release_pri_genres')?.textContent || '';
        elements.genres = genreText
            .split(',')
            .map(g => g.trim())
            .filter(g => g);

        // Extract secondary genres as influences
        const influenceText = document.querySelector('.release_sec_genres')?.textContent || '';
        elements.influences = influenceText
            .split(',')
            .map(i => i.trim())
            .filter(i => i);

        return elements;
    }

    // Function to fetch and parse a release page
    async function fetchRelease(url) {
        try {
            const response = await fetch(url);
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            
            const elements = {
                descriptors: [],
                genres: [],
                influences: [],
                releaseName: '',
                artistName: ''
            };

            // Extract release and artist names from the media link container
            const mediaContainer = doc.querySelector('.media_link_container');
            if (mediaContainer) {
                elements.releaseName = mediaContainer.getAttribute('data-albums') || '';
                elements.artistName = mediaContainer.getAttribute('data-artists') || '';
            }

            // Extract descriptors from the primary descriptors span
            const descriptorsSpan = doc.querySelector('.release_pri_descriptors');
            if (descriptorsSpan) {
                elements.descriptors = descriptorsSpan.textContent
                    .split(',')
                    .map(d => d.trim())
                    .filter(d => d);
            }

            // Extract primary genres (the main genres)
            const genreText = doc.querySelector('.release_pri_genres')?.textContent || '';
            elements.genres = genreText
                .split(',')
                .map(g => g.trim())
                .filter(g => g);

            // Extract secondary genres as influences
            const influenceText = doc.querySelector('.release_sec_genres')?.textContent || '';
            elements.influences = influenceText
                .split(',')
                .map(i => i.trim())
                .filter(i => i);

            return elements;
        } catch (error) {
            console.error('Error fetching release:', error);
            return null;
        }
    }

    // Function to find overlapping and unique elements
    function compareElements(elements1, elements2) {
        const result = {
            overlapping: [],
            unique1: [],
            unique2: []
        };

        // Find overlapping elements
        result.overlapping = elements1.filter(element => elements2.includes(element));

        // Find unique elements for first release
        result.unique1 = elements1.filter(element => !elements2.includes(element));

        // Find unique elements for second release
        result.unique2 = elements2.filter(element => !elements1.includes(element));

        return result;
    }

    // Function to create and display comparison results
    function displayComparison(elements1, elements2) {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1a1a1a;
            color: #ccc;
            padding: 20px;
            border: 1px solid #333;
            border-radius: 4px;
            max-width: 400px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 9999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 13px;
        `;

        const styles = `
            <style>
                .comparison-container h3 {
                    color: #66ccff;
                    font-size: 16px;
                    margin: 15px 0 10px 0;
                    font-weight: 500;
                }
                .comparison-container h4 {
                    color: #999;
                    font-size: 14px;
                    margin: 10px 0 5px 0;
                    font-weight: 400;
                }
                .comparison-container ul {
                    margin: 5px 0 15px 0;
                    padding-left: 20px;
                    list-style-type: none;
                }
                .comparison-container li {
                    color: #ccc;
                    margin: 3px 0;
                    font-size: 13px;
                }
                .comparison-container li::before {
                    content: "•";
                    color: #666;
                    display: inline-block;
                    width: 1em;
                    margin-left: -1em;
                }
            </style>
        `;

        container.classList.add('comparison-container');
        container.innerHTML = styles;

        // Compare descriptors
        const descriptorComparison = compareElements(elements1.descriptors, elements2.descriptors);
        container.innerHTML += `
            <h3>Descriptors</h3>
            <h4>Overlapping:</h4>
            <ul>${descriptorComparison.overlapping.map(d => `<li>${d}</li>`).join('')}</ul>
            <h4>Unique to ${elements1.releaseName} by ${elements1.artistName}:</h4>
            <ul>${descriptorComparison.unique1.map(d => `<li>${d}</li>`).join('')}</ul>
            <h4>Unique to ${elements2.releaseName} by ${elements2.artistName}:</h4>
            <ul>${descriptorComparison.unique2.map(d => `<li>${d}</li>`).join('')}</ul>
        `;

        // Compare combined genres and influences
        const combined1 = [...elements1.genres, ...elements1.influences];
        const combined2 = [...elements2.genres, ...elements2.influences];
        const combinedComparison = compareElements(combined1, combined2);
        container.innerHTML += `
            <h3>Combined Genres & Influences</h3>
            <h4>Overlapping:</h4>
            <ul>${combinedComparison.overlapping.map(c => `<li>${c}</li>`).join('')}</ul>
            <h4>Unique to ${elements1.releaseName} by ${elements1.artistName}:</h4>
            <ul>${combinedComparison.unique1.map(c => `<li>${c}</li>`).join('')}</ul>
            <h4>Unique to ${elements2.releaseName} by ${elements2.artistName}:</h4>
            <ul>${combinedComparison.unique2.map(c => `<li>${c}</li>`).join('')}</ul>
        `;

        // Compare genres
        const genreComparison = compareElements(elements1.genres, elements2.genres);
        container.innerHTML += `
            <h3>Genres</h3>
            <h4>Overlapping:</h4>
            <ul>${genreComparison.overlapping.map(g => `<li>${g}</li>`).join('')}</ul>
            <h4>Unique to ${elements1.releaseName} by ${elements1.artistName}:</h4>
            <ul>${genreComparison.unique1.map(g => `<li>${g}</li>`).join('')}</ul>
            <h4>Unique to ${elements2.releaseName} by ${elements2.artistName}:</h4>
            <ul>${genreComparison.unique2.map(g => `<li>${g}</li>`).join('')}</ul>
        `;

        // Compare influences
        const influenceComparison = compareElements(elements1.influences, elements2.influences);
        container.innerHTML += `
            <h3>Influences</h3>
            <h4>Overlapping:</h4>
            <ul>${influenceComparison.overlapping.map(i => `<li>${i}</li>`).join('')}</ul>
            <h4>Unique to ${elements1.releaseName} by ${elements1.artistName}:</h4>
            <ul>${influenceComparison.unique1.map(i => `<li>${i}</li>`).join('')}</ul>
            <h4>Unique to ${elements2.releaseName} by ${elements2.artistName}:</h4>
            <ul>${influenceComparison.unique2.map(i => `<li>${i}</li>`).join('')}</ul>
        `;

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 0;
            width: 20px;
            height: 20px;
            line-height: 20px;
            text-align: center;
            background: transparent;
            color: #666;
            border: none;
            font-size: 20px;
            cursor: pointer;
            transition: color 0.2s ease;
        `;
        closeButton.onmouseover = () => closeButton.style.color = '#fff';
        closeButton.onmouseout = () => closeButton.style.color = '#666';
        closeButton.onclick = () => container.remove();
        container.appendChild(closeButton);

        document.body.appendChild(container);
    }

    // Main function to handle the comparison
    function main() {
        // Check if we're on a RYM release page
        if (!window.location.href.includes('rateyourmusic.com/release/')) {
            return;
        }

        // Create a button to trigger the comparison
        const compareButton = document.createElement('button');
        compareButton.textContent = 'Compare Releases';
        compareButton.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin: 0 4px;
            padding: 6px 10px;
            background: #1f1f1f;
            color: #999;
            border: 1px solid #333;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 400;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            text-decoration: none;
            white-space: nowrap;
            transition: all 0.2s ease;
        `;

        compareButton.addEventListener('mouseover', () => {
            compareButton.style.background = '#333';
            compareButton.style.borderColor = '#444';
            compareButton.style.color = '#fff';
        });

        compareButton.addEventListener('mouseout', () => {
            compareButton.style.background = '#1f1f1f';
            compareButton.style.borderColor = '#333';
            compareButton.style.color = '#999';
        });

        // // Find the descriptor area and insert the button after it
        // const descriptorArea = document.querySelector('.release_descriptors');
        // if (descriptorArea) {
        //     descriptorArea.parentNode.insertBefore(compareButton, descriptorArea.nextSibling);
        // }
        // Find the <table class="album_info"> element:
        const albumInfoTable = document.querySelector('table.album_info');

        if (albumInfoTable) {
          // Insert the button immediately after the album_info table
          albumInfoTable.parentNode.insertBefore(compareButton, albumInfoTable.nextSibling);
        }

        compareButton.onclick = async () => {
            const url2 = prompt('Enter URL of release to compare with:');

            if (url2) {
                const elements1 = extractElements(); // Current page
                const elements2 = await fetchRelease(url2); // Fetch and parse second page
                
                if (elements2) {
                    displayComparison(elements1, elements2);
                } else {
                    alert('Failed to fetch the comparison release. Please check the URL and try again.');
                }
            }
        };
    }

    // Run the main function when the page loads
    window.addEventListener('load', main);
})(); 