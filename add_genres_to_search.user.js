// ==UserScript==
// @name         RYM Add Genres to Search
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Adds a button to copy all genres from a release to the search field
// @author       Helena S.
// @match        https://rateyourmusic.com/charts/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Function to extract all genres from the current page
    function extractGenres() {
        const genres = new Set();
        
        // Extract primary genres
        const primaryGenres = document.querySelector('.release_pri_genres');
        if (primaryGenres) {
            primaryGenres.textContent
                .split(',')
                .map(g => g.trim())
                .filter(g => g)
                .forEach(g => genres.add(g));
        }

        // Extract secondary genres
        const secondaryGenres = document.querySelector('.release_sec_genres');
        if (secondaryGenres) {
            secondaryGenres.textContent
                .split(',')
                .map(g => g.trim())
                .filter(g => g)
                .forEach(g => genres.add(g));
        }

        return Array.from(genres);
    }

    // Function to add genres to search
    function addGenresToSearch() {
        const genres = extractGenres();
        const searchInput = document.querySelector('input[type="search"]');
        if (searchInput) {
            // Join genres with commas and add to search
            searchInput.value = genres.join(', ');
            // Trigger input event to ensure any listeners are notified
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // Create and add the button
    function addButton() {
        const button = document.createElement('button');
        button.textContent = 'Add Genres to Search';
        button.style.cssText = `
            background: #1a1a1a;
            color: #66ccff;
            border: 1px solid #333;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 13px;
            margin: 10px 0;
            transition: all 0.2s ease;
        `;
        
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = '#333';
        });
        
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = '#1a1a1a';
        });
        
        button.addEventListener('click', addGenresToSearch);

        // Add button near the release title
        const titleContainer = document.querySelector('.release_title_and_year');
        if (titleContainer) {
            titleContainer.appendChild(button);
        }
    }

    // Initialize when page loads
    window.addEventListener('load', addButton);
})(); 