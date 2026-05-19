// ==UserScript==
// @name         RYM Release Chart Button
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Adds a button at the end of the main info section on release pages that opens a custom RYM chart with the release's genres, influences, and descriptors pre-set.
// @author       Helena S.
// @match        https://rateyourmusic.com/release/*
// @match        http://rateyourmusic.com/release/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rateyourmusic.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  function slugify(text) {
    return text.trim().toLowerCase().replace(/\s+/g, '-');
  }

  function collectGenres() {
    const slugs = [];
    document.querySelectorAll('span.release_pri_genres a.genre').forEach(function (a) {
      const m = (a.getAttribute('href') || '').match(/\/genre\/([^/]+)\//);
      if (m) slugs.push(m[1]);
    });
    return slugs;
  }

  function collectInfluences() {
    const slugs = [];
    document.querySelectorAll('span.release_sec_genres a.genre').forEach(function (a) {
      const m = (a.getAttribute('href') || '').match(/\/genre\/([^/]+)\//);
      if (m) slugs.push(m[1]);
    });
    return slugs;
  }

  function collectDescriptors() {
    const span = document.querySelector('span.release_pri_descriptors');
    if (!span || !span.textContent.trim()) return [];
    return span.textContent.split(',').map(function (s) { return slugify(s); }).filter(Boolean);
  }

  function buildChartUrl(genres, influences, descriptors) {
    const parts = [];
    if (genres.length)      parts.push('g:all,' + genres.join(','));
    if (influences.length)  parts.push('ge:all,' + influences.join(','));
    if (descriptors.length) parts.push('d:all,' + descriptors.join(','));
    return 'https://rateyourmusic.com/charts/top/album,ep,mixtape,djmix/all-time/' + parts.join('/') + '/excl:ratings/';
  }

  function getAlbumId() {
    const link = document.querySelector('a[href*="rgenre/set"]');
    if (link) {
      const m = (link.getAttribute('href') || '').match(/album_id=(\d+)/);
      if (m) return m[1];
    }
    const inp = document.querySelector('input[name="albumid"], input[name="album_id"]');
    if (inp) return inp.value;
    return null;
  }

  // Loads the rgenre/set page in a hidden same-origin iframe so its JS runs and
  // populates the genre rows, then reads parent genres from the rendered DOM.
  function loadGenreSetInFrame(albumId) {
    return new Promise(function (resolve, reject) {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:absolute; width:0; height:0; border:0; visibility:hidden;';
      iframe.src = 'https://rateyourmusic.com/rgenre/set?album_id=' + albumId;

      let settled = false;
      const finish = function (fn) { if (settled) return; settled = true; fn(); };

      // Poll the iframe document until genre rows appear (or timeout)
      const poll = setInterval(function () {
        try {
          const doc = iframe.contentDocument;
          if (!doc) return;
          // Found rendered genre rows: each `a.genre` lives in a td alongside ⤷ <p>
          const links = doc.querySelectorAll('a.genre[href*="/genre/"]');
          if (links.length > 0) {
            finish(function () {
              clearInterval(poll);
              resolve(doc);
              setTimeout(function () { iframe.remove(); }, 0);
            });
          }
        } catch (e) { /* cross-origin while loading — ignore */ }
      }, 200);

      setTimeout(function () {
        finish(function () {
          clearInterval(poll);
          iframe.remove();
          reject(new Error('rgenre/set iframe timed out'));
        });
      }, 15000);

      document.body.appendChild(iframe);
    });
  }

  async function fetchParentGenres() {
    const albumId = getAlbumId();
    if (!albumId) throw new Error('album_id not found on release page');

    const doc = await loadGenreSetInFrame(albumId);

    const releaseGenres     = collectGenres();
    const releaseInfluences = collectInfluences();
    const primarySlugs      = new Set();
    const influenceSlugs    = new Set();

    // Each genre entry: <div><a class="genre" href="/genre/SLUG/">Name</a></div><p>⤷ Parent</p>
    doc.querySelectorAll('a.genre[href*="/genre/"]').forEach(function (a) {
      const m = (a.getAttribute('href') || '').match(/\/genre\/([^/]+)\//);
      if (!m) return;
      const thisSlug = m[1];

      const target = releaseInfluences.includes(thisSlug) ? influenceSlugs
                   : releaseGenres.includes(thisSlug)     ? primarySlugs
                   : null;
      if (!target) return;

      // The ⤷ paragraph is the next sibling of the genre's containing div
      const containerDiv = a.parentElement;
      if (!containerDiv) return;
      const next = containerDiv.nextElementSibling;
      if (!next || next.tagName !== 'P') return;
      const text = next.textContent.trim();
      if (!text.startsWith('⤷')) return;
      text.replace(/^⤷\s*/, '').split(',').forEach(function (name) {
        const s = slugify(name);
        if (s) target.add(s);
      });
    });

    return {
      primarySlugs:   Array.from(primarySlugs),
      influenceSlugs: Array.from(influenceSlugs),
    };
  }

  function makeBtn(label, url) {
    const btn = document.createElement('div');
    btn.className = 'more_btn';
    btn.textContent = label;
    btn.style.fontSize = '12px';
    btn.style.lineHeight = '27.6px';
    btn.onclick = function () { window.open(url, '_blank'); };
    return btn;
  }

  function makeAsyncBtn(label, onClick) {
    const btn = document.createElement('div');
    btn.className = 'more_btn';
    btn.textContent = label;
    btn.style.fontSize = '12px';
    btn.style.lineHeight = '27.6px';
    btn.onclick = async function () {
      btn.textContent = '…';
      btn.style.pointerEvents = 'none';
      try {
        await onClick();
      } catch (e) {
        console.error('[ebr-chart-btn]', e);
        btn.textContent = 'Error';
      } finally {
        btn.textContent = label;
        btn.style.pointerEvents = '';
      }
    };
    return btn;
  }

  function addButton() {
    const table = document.querySelector('table.album_info');
    if (!table) return;

    const genres      = collectGenres();
    const influences  = collectInfluences();
    const descriptors = collectDescriptors();

    if (!genres.length && !influences.length && !descriptors.length) return;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex; flex-direction:row; flex-wrap:wrap;';
    const firstBtn = makeBtn('Genres & Descriptors', buildChartUrl(genres, influences, descriptors));
    firstBtn.style.paddingLeft = '0.8em';
    firstBtn.style.marginLeft = '0';
    wrapper.appendChild(firstBtn);
    wrapper.appendChild(makeBtn('Just Genres',      buildChartUrl(genres, influences, [])));
    wrapper.appendChild(makeBtn('Just Descriptors', buildChartUrl([], [], descriptors)));

    if (genres.length || influences.length) {
      wrapper.appendChild(makeAsyncBtn('Parent Genres', async function () {
        const { primarySlugs, influenceSlugs } = await fetchParentGenres();
        const url = buildChartUrl(primarySlugs, influenceSlugs, []);
        window.open(url, '_blank');
      }));
    }

    const td = document.createElement('td');
    td.appendChild(wrapper);

    const th = document.createElement('th');
    th.className = 'info_hdr';
    th.textContent = 'Charts';

    const tr = document.createElement('tr');
    tr.appendChild(th);
    tr.appendChild(td);

    table.querySelector('tbody').appendChild(tr);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addButton);
  } else {
    addButton();
  }
})();