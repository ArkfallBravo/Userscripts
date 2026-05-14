import pandas as pd
import time
from datetime import datetime
from bs4 import BeautifulSoup
import re
import cloudscraper

# -----------------------------------------------------------------------------
# 1. SLUGIFY HELPER
# -----------------------------------------------------------------------------
def slugify(text: str) -> str:
    """
    Convert a string into an RYM‐compatible slug:
      - Lowercase everything
      - Remove any character that is not a letter, number, or space
      - Collapse multiple spaces into one
      - Replace spaces with hyphens
    Example:
      "Let's Go to My Star!" → "lets-go-to-my-star"
    """
    if not text or not isinstance(text, str):
        return ""
    # Lowercase
    s = text.lower()
    # Replace any non-alphanumeric (excluding spaces) with a space
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    # Collapse multiple spaces into one
    s = re.sub(r"\s+", " ", s).strip()
    # Replace spaces with hyphens
    return s.replace(" ", "-")

# -----------------------------------------------------------------------------
# 2. VALID STRING CHECK
# -----------------------------------------------------------------------------
def is_valid_string(s: str) -> bool:
    """
    Return True if `s` is a non‐empty string that isn't "nan" (case‐insensitive).
    """
    if s is None:
        return False
    if not isinstance(s, str):
        return False
    st = s.strip().lower()
    if st == "" or st == "nan":
        return False
    return True

# -----------------------------------------------------------------------------
# 3. PARSER FUNCTIONS (unchanged)
# -----------------------------------------------------------------------------
def parse_rating_counts(soup: BeautifulSoup) -> dict:
    counts = {
        "5.0": 0,
        "4.5": 0,
        "4.0": 0,
        "3.5": 0,
        "3.0": 0,
        "2.5": 0,
        "2.0": 0,
        "1.5": 0,
        "1.0": 0,
        "0.5": 0,
    }

    histogram = soup.find("div", class_="ratings_histogram")
    if not histogram:
        return counts

    for row in histogram.find_all("div", class_="rating_row"):
        label_tag = row.find("span", class_="rating_label")
        count_tag = row.find("span", class_="rating_count")
        if label_tag and count_tag:
            label = label_tag.get_text(strip=True)  # e.g. "5.0"
            raw_count = count_tag.get_text(strip=True).replace(",", "")
            try:
                cnt = int(raw_count)
            except ValueError:
                cnt = 0
            if label in counts:
                counts[label] = cnt

    return counts

def parse_genres_influences(soup: BeautifulSoup) -> (list, list):
    genres = []
    influences = []

    pri_genre_div = soup.find("div", class_="release_pri_genres")
    if pri_genre_div:
        for a in pri_genre_div.find_all("a"):
            txt = a.get_text(strip=True)
            if txt:
                genres.append(txt)

    sec_genre_div = soup.find("div", class_="release_sec_genres")
    if sec_genre_div:
        for a in sec_genre_div.find_all("a"):
            txt = a.get_text(strip=True)
            if txt and txt not in genres:
                genres.append(txt)

    infl_section = soup.find("ul", class_="release_influences")
    if infl_section:
        for li in infl_section.find_all("li"):
            txt = li.get_text(strip=True)
            if txt:
                influences.append(txt)
    else:
        infl_div = soup.find("div", class_="influences")
        if infl_div:
            for a in infl_div.find_all("a"):
                txt = a.get_text(strip=True)
                if txt:
                    influences.append(txt)

    return genres, influences

def parse_descriptors(soup: BeautifulSoup) -> list:
    descriptors = []

    pri_desc_div = soup.find("div", class_="release_pri_descriptors")
    if pri_desc_div:
        for a in pri_desc_div.find_all("a"):
            txt = a.get_text(strip=True)
            if txt:
                descriptors.append(txt)
    else:
        desc_list = soup.find("ul", class_="release_descriptors")
        if desc_list:
            for li in desc_list.find_all("li"):
                txt = li.get_text(strip=True)
                if txt:
                    descriptors.append(txt)

    return descriptors

# -----------------------------------------------------------------------------
# 4. MAIN: READ CSV, SCRAPE, AUGMENT, WRITE NEW CSV
# -----------------------------------------------------------------------------
def main():
    input_csv  = "/Users/lillyanasimson/Library/Mobile Documents/com~apple~CloudDocs/Userscripts/ArkfallOverfall-music-export-3.csv"
    output_csv = "/Users/lillyanasimson/Library/Mobile Documents/com~apple~CloudDocs/Userscripts/ArkfallOverfall-music-export-3_withRYMinfo.csv"

    df = pd.read_csv(input_csv, dtype=str)
    df.columns = [c.strip() for c in df.columns]

    # Prepare rating and metadata columns
    rating_columns = [f"rating_{star}" for star in ["5.0","4.5","4.0","3.5","3.0","2.5","2.0","1.5","1.0","0.5"]]
    for col in rating_columns:
        df[col] = 0
    df["retrieval_date"] = ""
    df["genres"]         = ""
    df["influences"]     = ""
    df["descriptors"]    = ""

    total = len(df)

    # Create a cloudscraper session once
    scraper = cloudscraper.create_scraper(
        browser={
            "browser": "chrome",
            "platform": "darwin",
            "mobile": False
        }
    )
    # Optionally tweak headers further if needed:
    scraper.headers.update({
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Referer": "https://rateyourmusic.com/",
        "Connection": "keep-alive",
    })

    for idx, row in df.iterrows():
        # --- 4A. Determine artist_name ---
        artist_name = ""
        fn_loc = row.get("First Name localized", "")
        ln_loc = row.get("Last Name localized", "")
        fn_orig = row.get("First Name", "")
        ln_orig = row.get("Last Name", "")

        if is_valid_string(fn_loc) or is_valid_string(ln_loc):
            parts = []
            if is_valid_string(fn_loc):
                parts.append(fn_loc.strip())
            if is_valid_string(ln_loc):
                parts.append(ln_loc.strip())
            artist_name = " ".join(parts)
        elif is_valid_string(fn_orig) or is_valid_string(ln_orig):
            parts = []
            if is_valid_string(fn_orig):
                parts.append(fn_orig.strip())
            if is_valid_string(ln_orig):
                parts.append(ln_orig.strip())
            artist_name = " ".join(parts)
        else:
            df.at[idx, "retrieval_date"] = datetime.now().isoformat()
            continue

        # --- 4B. Determine album_title ---
        album_title = row.get("Title", "").strip()
        if not is_valid_string(album_title):
            df.at[idx, "retrieval_date"] = datetime.now().isoformat()
            continue

        # --- 4C. Build slugs and URL ---
        artist_slug = slugify(artist_name)
        album_slug  = slugify(album_title)
        if not artist_slug or not album_slug:
            df.at[idx, "retrieval_date"] = datetime.now().isoformat()
            continue

        url = f"https://rateyourmusic.com/release/album/{artist_slug}/{album_slug}/"
        print(f"[{idx+1}/{total}] Fetching URL → {url}")

        # -------------------------
        # Replace requests.get(...) with scraper.get(...)
        # -------------------------
        try:
            resp = scraper.get(url, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
        except Exception as e:
            print(f"   → ERROR fetching {url}: {e}")
            # Immediately skip to the next row (no sleep)
            df.at[idx, "retrieval_date"] = datetime.now().isoformat()
            continue

        # 4D1. Parse rating counts
        counts = parse_rating_counts(soup)
        for star_label, cnt in counts.items():
            col_name = f"rating_{star_label}"
            if col_name in df.columns:
                df.at[idx, col_name] = cnt

        df.at[idx, "retrieval_date"] = datetime.now().isoformat()

        genres, influences = parse_genres_influences(soup)
        df.at[idx, "genres"]     = ";".join(genres)
        df.at[idx, "influences"] = ";".join(influences)

        descs = parse_descriptors(soup)
        df.at[idx, "descriptors"] = ";".join(descs)

        # Wait 10 seconds before the next row
        time.sleep(10)

    df.to_csv(output_csv, index=False)
    print(f"\nFinished—output saved to:\n  {output_csv}")

if __name__ == "__main__":
    main()