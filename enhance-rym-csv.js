/**
 * enhance-rym-csv.js (revised)
 *
 * Reads “ArkfallOverfall-music-export-3.csv”, fetches additional info
 * (rating counts, genres, descriptors, influences) from RateYourMusic for each
 * album, and writes out “ArkfallOverfall-music-with-rym-info.csv”.
 *
 * Improvements over the original:
 * 1) We no longer `require('node-fetch')`. Node.js v18+ provides a global `fetch`.
 * 2) If a fetch or parse “fails” for one album, we log the error and immediately move on
 *    (no 10-second wait in that case). Only successful fetches incur the 10-second sleep.
 *
 * Usage:
 *   node enhance-rym-csv.js
 *
 * Ensure you are running this file from the same folder in which it lives,
 * and that you have run:
 *   npm install fast-csv cheerio
 * (You do NOT need to install node-fetch.)
 */

const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const cheerio = require('cheerio');

// —  Helper functions — //

/**
 * slugify: Lowercase, strip non-alphanumerics (except spaces/hyphens),
 * replace spaces with hyphens, collapse runs of hyphens.
 *
 * NOTE: If the artist name or album title contains only non-Latin characters,
 *       slugify(...) will be "" (empty). In that case, we skip fetching entirely.
 */
function slugify(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // drop accents, punctuation, non-Latin
    .replace(/\s+/g, '-')          // spaces → hyphens
    .replace(/-+/g, '-');          // collapse multiple hyphens
}

/**
 * Construct a RYM URL from artistName + albumTitle slugs:
 *
 *   https://rateyourmusic.com/release/album/{artist-slug}/{album-slug}/
 *
 * If either slug comes out empty, we’ll return an empty string to signal:
 *   “No valid URL → skip fetch.”
 */
function buildRymUrl(artistName, albumTitle) {
  const artistSlug = slugify(artistName);
  const albumSlug = slugify(albumTitle);
  if (!artistSlug || !albumSlug) {
    return '';
  }
  return `https://rateyourmusic.com/release/album/${artistSlug}/${albumSlug}/`;
}

/**
 * parseAlbumPage: given the HTML of a RYM album page, extract:
 *   • counts:  { "0.5": <number>, "1.0": <number>, …, "5.0": <number> }
 *   • genres: array of genre strings
 *   • descriptors: array of descriptor strings
 *   • influences: array of influence strings
 *
 * If any section is missing, returns empty arrays/objects for that field.
 */
function parseAlbumPage(html) {
  const $ = cheerio.load(html);

  // 1) Genres: Look inside <meta name="description" content="… Genres: A, B, C. …">
  let genres = [];
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const genreMatch = metaDesc.match(/Genres:\s*([^\.]+)/i);
  if (genreMatch) {
    genres = genreMatch[1]
      .split(',')
      .map((g) => g.trim())
      .filter((g) => g.length);
  }

  // 2) Descriptors: Find <th>Descriptors</th> → sibling <td> … collect <meta content="…"> or fallback
  let descriptors = [];
  $('th')
    .filter((i, el) => $(el).text().trim().toLowerCase() === 'descriptors')
    .each((i, el) => {
      const td = $(el).next('td');
      // Collect any <meta content="…">
      td.find('meta[content]').each((j, m) => {
        const val = $(m).attr('content').trim();
        if (val) descriptors.push(val);
      });
      // Fallback: maybe <span class="release_pri_descriptors">A; B; C</span>
      if (descriptors.length === 0) {
        td
          .find('span.release_pri_descriptors')
          .text()
          .split(/[,;]/)
          .map((d) => d.trim())
          .forEach((d) => {
            if (d) descriptors.push(d);
          });
      }
    });

  // 3) Influences: Find <th>Influences</th> → collect similarly
  let influences = [];
  $('th')
    .filter((i, el) => $(el).text().trim().toLowerCase() === 'influences')
    .each((i, el) => {
      const td = $(el).next('td');
      td.find('meta[content]').each((j, m) => {
        const val = $(m).attr('content').trim();
        if (val) influences.push(val);
      });
      if (influences.length === 0) {
        td
          .text()
          .split(/[,;]/)
          .map((d) => d.trim())
          .forEach((d) => {
            if (d) influences.push(d);
          });
      }
    });

  // 4) Rating counts: RYM injects a JS snippet like:
  //     data.addRows([
  //       [0.5, 3], [1.0, 3], …, [5.0, 95]
  //     ]);
  //
  // We search all <script> blocks for “data.addRows( [ … ] )” and parse it.
  const counts = {};
  const scriptBlocks = $('script')
    .map((i, el) => $(el).html())
    .get()
    .join('\n');

  const rowsMatch = scriptBlocks.match(
    /data\.addRows\(\s*\[\s*((?:\[\s*[\d.]+,\s*\d+\s*\],?\s*)+)\s*\]\s*\)/m
  );
  if (rowsMatch) {
    const inside = rowsMatch[1];
    const pairRe = /\[\s*([\d.]+)\s*,\s*(\d+)\s*\]/g;
    let m;
    while ((m = pairRe.exec(inside)) !== null) {
      const ratingKey = parseFloat(m[1]).toFixed(1); // e.g. “5.0”
      const cnt = parseInt(m[2], 10);
      counts[ratingKey] = cnt;
    }
  }

  return {
    genres,
    descriptors,
    influences,
    counts,
  };
}

/**
 * fetchAlbumInfo: Given an artist name + album title, attempt to fetch and parse
 * the RYM page. Returns a Promise that resolves to an object:
 *   { genres: [], descriptors: [], influences: [], counts: {} }
 *
 * If the URL is empty (invalid slug), or if any part of fetch/parse errors out,
 * we reject with an Error so that the caller can “skip” immediately.
 */
async function fetchAlbumInfo(artistName, albumTitle) {
  const url = buildRymUrl(artistName, albumTitle);
  if (!url) {
    throw new Error(`Invalid slug for artist="${artistName}", album="${albumTitle}" → skipping`);
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', // pretend to be a normal browser
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for URL: ${url}`);
  }
  const html = await res.text();
  return parseAlbumPage(html);
}

// —  Main Script — //

(async () => {
  const INPUT_CSV = path.resolve(__dirname, 'ArkfallOverfall-music-export-3.csv');
  const OUTPUT_CSV = path.resolve(__dirname, 'ArkfallOverfall-music-with-rym-info.csv');

  // 1) Read all rows from the input CSV
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(INPUT_CSV)
      .pipe(csv.parse({ headers: true, ignoreEmpty: true }))
      .on('error', (err) => reject(err))
      .on('data', (row) => {
        // Trim whitespace:
        Object.keys(row).forEach((k) => {
          if (typeof row[k] === 'string') row[k] = row[k].trim();
        });
        rows.push(row);
      })
      .on('end', () => resolve());
  });

  if (rows.length === 0) {
    console.error('❌ No rows found in input CSV. Exiting.');
    process.exit(1);
  }

  // 2) Prepare output CSV & headers
  const originalHeaders = Object.keys(rows[0]);
  const newHeaders = [
    ...originalHeaders,
    'retrieved_date',
    'genres',
    'descriptors',
    'influences',
    'count_0.5',
    'count_1.0',
    'count_1.5',
    'count_2.0',
    'count_2.5',
    'count_3.0',
    'count_3.5',
    'count_4.0',
    'count_4.5',
    'count_5.0',
  ];

  const writeStream = fs.createWriteStream(OUTPUT_CSV, { encoding: 'utf8' });
  const csvWriter = csv.format({ headers: newHeaders });
  csvWriter.pipe(writeStream);

  console.log(`→ Found ${rows.length} rows. Fetching info—one album at a time.\n`);

  // 3) Loop through each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Depending on your CSV, adjust exactly how you extract artistName + albumTitle.
    // In your original CSV it looks like “First Name” + “Last Name” might hold the artist,
    // and “Title” holds the album. Adjust keys if yours differ.
    const artistFirst = row['First Name'] || row['Artist'] || '';
    const artistLast = row['Last Name'] || '';
    const artistName = [artistFirst, artistLast].filter((s) => s).join(' ').trim();
    const albumTitle = row['Title'] || row['Album'] || '';

    process.stdout.write(`(${i + 1}/${rows.length}) Fetching: ${artistName} – “${albumTitle}”… `);

    let fetched = false;
    let info = {
      genres: [],
      descriptors: [],
      influences: [],
      counts: {},
    };

    try {
      // Attempt to fetch + parse. This may throw if slug is invalid or HTTP 404, etc.
      info = await fetchAlbumInfo(artistName, albumTitle);
      fetched = true;
      console.log('✅');
    } catch (err) {
      // On any error—invalid slug, 404, parse failure—we log and immediately skip to next row.
      console.warn(`⚠️  SKIPPED → ${err.message}`);
      // We will write out “empty” fields below, and move on WITHOUT waiting 10 seconds.
    }

    // Build the augmented row
    const nowISO = new Date().toISOString();
    const out = {
      ...row,
      retrieved_date: fetched ? nowISO : '', // only set timestamp if we actually fetched
      genres: fetched ? info.genres.join('; ') : '',
      descriptors: fetched ? info.descriptors.join('; ') : '',
      influences: fetched ? info.influences.join('; ') : '',
      'count_0.5': fetched && info.counts['0.5'] ? info.counts['0.5'] : 0,
      'count_1.0': fetched && info.counts['1.0'] ? info.counts['1.0'] : 0,
      'count_1.5': fetched && info.counts['1.5'] ? info.counts['1.5'] : 0,
      'count_2.0': fetched && info.counts['2.0'] ? info.counts['2.0'] : 0,
      'count_2.5': fetched && info.counts['2.5'] ? info.counts['2.5'] : 0,
      'count_3.0': fetched && info.counts['3.0'] ? info.counts['3.0'] : 0,
      'count_3.5': fetched && info.counts['3.5'] ? info.counts['3.5'] : 0,
      'count_4.0': fetched && info.counts['4.0'] ? info.counts['4.0'] : 0,
      'count_4.5': fetched && info.counts['4.5'] ? info.counts['4.5'] : 0,
      'count_5.0': fetched && info.counts['5.0'] ? info.counts['5.0'] : 0,
    };

    csvWriter.write(out);

    // 4) If the fetch succeeded, wait 10 seconds. Otherwise, go straight to the next row.
    if (fetched && i < rows.length - 1) {
      process.stdout.write('    (waiting 10s …)\n');
      await new Promise((r) => setTimeout(r, 10_000));
    } else {
      process.stdout.write('\n');
    }
  }

  csvWriter.end();
  console.log(`\n✅ Done! Wrote enhanced CSV to:\n   ${OUTPUT_CSV}`);
})();