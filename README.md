# Dynamic Web Scraper

A lightweight, config-driven web scraper built with JavaScript. Define the pages and selectors you want, and this scraper will fetch, parse, paginate, and save data for you.

## Features

- Config-driven scraping with a single source of truth in `config.js`
- Automatic pagination support
- Flexible pagination patterns for query-string and path-based URLs
- Works with common selector-based extraction flows
- Saves structured data to `data.json`
- Built-in HTTP error handling with timeout and safe fallback behavior

## Tech Stack

- Node.js
- JavaScript (ES Modules)
- Axios
- Cheerio

## Repository Layout

- `config.js` — target pages, selectors, and pagination configuration
- `scraper.js` — scraping flow and output generation
- `data.json` — generated output file
- `package.json` — project metadata and dependencies

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the scrape target

Open `config.js` and update the base URL, page list, selectors, and pagination pattern.

```javascript
export const config = {
  baseUrl: "https://www.scrapethissite.com/",
  pages: ["pages/forms"],
  requestDelay: 1000,
  maxPages: 50,
  checkNextLink: true,
  paginationPattern: [
    "?page_num={page}",
    "?page={page}",
    "?p={page}",
    "/page/{page}"
  ],
  pagination: {
    default: "?page_num={page}",
    "pages/forms": "?page_num={page}"
  },
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

### 3. Run the scraper

```bash
node scraper.js
```

The script will fetch the configured pages, scrape records, follow pagination rules, and save results to `data.json`.

---

## Configuration Guide

### `baseUrl`

The root URL for the website.

```javascript
baseUrl: "https://www.scrapethissite.com/"
```

### `pages`

A list of page paths to scrape. These get appended to `baseUrl`.

```javascript
pages: ["pages/forms", "pages/teams"]
```

This will generate URLs like:

```text
https://www.scrapethissite.com/pages/forms
https://www.scrapethissite.com/pages/teams
```

### `selectors`

A map of selectors for each page. The key should match a page path in `pages`.

```javascript
selectors: {
  "pages/forms": {
    container: ".team",
    name: ".name",
    year: ".year",
    win: ".wins",
    loss: ".losses"
  }
}
```

Each selector maps to a CSS selector used by Cheerio for extraction.

### `paginationPattern` (legacy support)

This is the older format supported for compatibility.

```javascript
paginationPattern: [
  "?page_num={page}",
  "?page={page}",
  "?p={page}",
  "/page/{page}"
]
```

This system tries each pattern until it finds one that works.

### `pagination` (recommended)

This newer format is more flexible and page-specific.

```javascript
pagination: {
  default: "?page_num={page}",
  "pages/forms": "?page_num={page}",
  "pages/teams": {
    type: "offset",
    pattern: "?offset={offset}&limit={limit}",
    limit: 20
  }
}
```

Supported options:
- `string`: `"?page={page}"`
- `array`: `["?page_num={page}", "?page={page}"]`
- `object`: `{ type: "page" | "offset", pattern: "...?", limit: 20 }`

Your pagination pattern can include placeholders like:
- `{page}`
- `{offset}`
- `{limit}`

---

## Pagination Behavior

The scraper loops through pages until it determines that the last page has been reached.

### Default behavior

If no pagination config is provided, it falls back to:

```javascript
"?page_num={page}"
```

### What the scraper does

1. Builds a URL using the selected pagination pattern
2. Fetches the page HTML
3. Extracts records using the configured selectors
4. Stops when:
   - no data is returned,
   - duplicate data is detected,
   - no next link is found (if enabled),
   - or the max page count is reached

### Example of a page pattern

```javascript
"?page_num={page}"
```

Turns into:

```text
https://www.scrapethissite.com/pages/forms?page_num=1
https://www.scrapethissite.com/pages/forms?page_num=2
https://www.scrapethissite.com/pages/forms?page_num=3
```

### Offset-based pagination

For sites using offset values:

```javascript
{
  type: "offset",
  pattern: "?offset={offset}&limit={limit}",
  limit: 20
}
```

This produces:

```text
?offset=0&limit=20
?offset=20&limit=20
?offset=40&limit=20
```

---

## Scraping Flow

### 1. Read the config

```javascript
const { baseUrl, pages, selectors, paginationPattern } = config;
```

### 2. Build the page URL

```javascript
const url = baseUrl + page;
```

### 3. Resolve the pagination strategy

The scraper tries the configured pagination strategy for the current page. It supports:
- a single string pattern,
- multiple candidate patterns,
- or a richer object-based pattern.

### 4. Fetch the HTML

```javascript
const html = await getHtml(url);
```

### 5. Parse with Cheerio

```javascript
const $ = cheerio.load(html);
```

### 6. Extract rows

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

### 7. Save the final output

```javascript
await fs.writeFile("data.json", JSON.stringify(data, null, 2), "utf-8");
```

---

## Example Configurations

### Simple query-parameter pagination

```javascript
export const config = {
  baseUrl: "https://example.com/",
  pages: ["products"],
  pagination: {
    default: "?page={page}"
  },
  selectors: {
    products: {
      container: ".product-card",
      name: ".product-name",
      price: ".price"
    }
  }
};
```

### Multiple fallback patterns

```javascript
export const config = {
  baseUrl: "https://example.com/",
  pages: ["products"],
  paginationPattern: [
    "?page_num={page}",
    "?page={page}",
    "/page/{page}"
  ],
  selectors: {
    products: {
      container: ".product-card",
      name: ".product-name",
      price: ".price"
    }
  }
};
```

### Offset-based pagination

```javascript
export const config = {
  baseUrl: "https://example.com/",
  pages: ["articles"],
  pagination: {
    "articles": {
      type: "offset",
      pattern: "?offset={offset}&limit={limit}",
      limit: 25
    }
  },
  selectors: {
    articles: {
      container: ".article",
      title: ".title",
      author: ".author"
    }
  }
};
```

---

## Common Pitfalls

### 1. Wrong pagination pattern

If the site uses `/page/2` but your config uses `?page=2`, the scraper will either get no data or loop incorrectly.

### 2. Selector mismatch

If the selectors target elements that no longer exist, the scraper will produce empty arrays.

### 3. JavaScript-heavy pages

Cheerio does not run JavaScript. If content is rendered client-side, the scraper may not see it.

### 4. Rate-limited sites

Large pages or frequent requests can trigger blocks. Use a higher `requestDelay` if needed.

---

## Recommended Improvements for the Future

These improvements would make this scraper even more robust:

- Add retry logic for failed requests
- Support login/session cookies
- Support JavaScript rendering via Playwright or Puppeteer
- Allow custom extraction functions per page
- Add CLI arguments for config overrides
- Add progress logging for large scrapes

---

## Summary

This scraper is intentionally simple: configuration drives the behavior. Once you define the URL structure, selectors, and pagination pattern, the scraper will handle the rest.

The new flexible pagination config makes it easier to support more real-world websites while keeping the project simple and reusable.

## License

ISC

## Author

CodeCraftedYash
