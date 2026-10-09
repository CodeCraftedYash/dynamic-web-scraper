# Dynamic Web Scraper

A simple, config-driven web scraper built with JavaScript. It is designed around one idea: define where to scrape and which selectors to use, then let the scraper handle the rest.

## Tech Stack

- Node.js
- JavaScript (ES Modules)
- Axios for HTTP requests
- Cheerio for HTML parsing and extraction

## What this project does

This scraper:
- loads a base URL from config
- loops through configured pages
- extracts structured data using CSS selectors
- optionally keeps scraping paginated pages until no more results are found using flexible pagination patterns
- saves the final output to `data.json`

## Repository Structure

- `config.js` — all scraping instructions live here
- `scraper.js` — fetches pages, extracts data, and saves output
- `data.json` — generated result file
- `package.json` — project dependencies and scripts

## How the config orchestrates everything

The whole scraping flow is controlled by `config.js`.

```javascript
export const config = {
  baseUrl: "https://www.scrapethissite.com/",
  pages: [
    "pages/forms"
  ],
  paginationPattern: [
    "?page_num={page}",
    "?page={page}",
    "?p={page}",
    "/page/{page}"
  ],
  selectors: {
    "pages/forms": {
      container: ".team",
      name: ".name",
      year: ".year",
      win: ".wins",
      loss: ".losses"
    }
  }
};
```

### What each field means

- `baseUrl`: root website URL
- `pages`: list of page paths to scrape
- `paginationPattern`: array of URL patterns for pagination. Use `{page}` as a placeholder for the page number. The scraper tries each pattern until it finds one that returns data
- `selectors`: the CSS selectors used for each page

Each entry in `selectors` is mapped to a page path. The script uses that page name to find the correct selector group.

## Step-by-step scraping flow

### 1. Read the config

In `main()`, the scraper reads:

```javascript
const { baseUrl, pages, selectors, paginationPattern } = config;
```

This gives the scraper the website URL, page list, extraction rules, and pagination patterns.

### 2. Build the page URL

For each page in `pages`, it creates a full URL:

```javascript
const url = baseUrl + page;
```

So if:

- `baseUrl` = `https://www.scrapethissite.com/`
- `page` = `pages/forms`

then the final URL becomes:

```text
https://www.scrapethissite.com/pages/forms
```

### 3. Pick the selectors for that page

The scraper looks up the right selector set:

```javascript
const pageSelector = selectors[page];
```

This means the config is the source of truth for how data is extracted.

### 4. Fetch the page HTML

The scraper uses Axios to request the page:

```javascript
const html = await getHtml(url);
```

### 5. Parse with Cheerio

The HTML is turned into a DOM-like structure:

```javascript
const $ = loadCheerio(html);
```

This makes it easy to query elements using CSS selectors.

### 6. Extract the data

The core extraction function is:

```javascript
function extractForms($, selectors) {
  const result = [];

  $(selectors.container).each((_, el) => {
    result.push({
      name: $(el).find(selectors.name).text().trim(),
      year: $(el).find(selectors.year).text().trim(),
      win: $(el).find(selectors.win).text().trim(),
      loss: $(el).find(selectors.loss).text().trim(),
    });
  });

  return result;
}
```

This loops through each container and reads the matching fields inside it.

### 7. Handle pagination

The scraper supports paginated websites through `scrapeAll()` with flexible pagination patterns.

```javascript
async function scrapeAll(url, selectors, paginationPattern = "?page_num={page}") {
  const allData = [];

  try {
    let page = 1;

    while (true) {
      const pageSuffix = paginationPattern.replace("{page}", String(page));
      const newUrl = `${url}${pageSuffix}`;
      const html = await getHtml(newUrl);

      if (!html) {
        console.log("No HTML returned for", newUrl);
        break;
      }

      const $ = loadCheerio(html);
      const data = extractForms($, selectors);

      if (data.length === 0) {
        console.log("last page was ", page - 1, "\n exiting scraping");
        break;
      }

      allData.push(...data);
      page++;
      console.log("done page : ", page);
      await delay(1000);
    }

    return allData;
  } catch (err) {
    console.log("Scrape error:", err.message);
    return [];
  }
}
```

How pagination works:

- `paginationPattern` accepts flexible URL patterns with `{page}` as a placeholder
- Common patterns include:
  - `?page_num={page}` — query parameter style
  - `?page={page}` — alternative query parameter
  - `?p={page}` — short query parameter
  - `/page/{page}` — path-based pagination
- The scraper replaces `{page}` with the page number (1, 2, 3...)
- It keeps going until the page returns no data, then stops automatically
- A delay between requests prevents overwhelming the server

## Basic usage

### Install dependencies

```bash
npm install
```

### Run the scraper

```bash
node scraper.js
```

### Output

The results are written to `data.json`.

## Single-page vs paginated scraping

In `main()`, the scraper is set to paginate by default using the pattern from `config.js`:

```javascript
const data = await scrapeAll(url, pageSelector, paginationPattern || "?page_num={page}");
```

If you want to scrape only a single page, you can switch to:

```javascript
const data = await scrape(url, pageSelector);
```

This is useful when the page does not have a pagination pattern or you only need one page of data.

## Configuring pagination for different websites

Different websites use different pagination URLs. Update `paginationPattern` in `config.js` to match your target site:

```javascript
// For query parameters:
paginationPattern: "?page_num={page}"

// For path-based pagination:
paginationPattern: "/page/{page}"

// For multiple patterns to try:
paginationPattern: [
  "?page_num={page}",
  "?page={page}",
  "/page/{page}"
]
```

The scraper will use the pattern you provide to build the correct pagination URLs.

## Example output

```json
[
  {
    "name": "Boston Bruins",
    "year": "1924",
    "win": "17",
    "loss": "14"
  }
]
```

## Notes

- The project is intentionally simple and easy to customize.
- Most behavior is controlled from `config.js`.
- For new websites, you usually only need to update:
  - `baseUrl`
  - `pages`
  - the selectors inside each page config
  - `paginationPattern` to match the target site's URL structure

## Summary

This repo is a lightweight scraping starter where configuration drives the work. Instead of writing custom logic for every page, you define the target page, selectors, and pagination pattern once, and the scraper handles fetching, parsing, pagination, and saving results.

That makes it easy to reuse for many similar sites without creating a complicated framework.
