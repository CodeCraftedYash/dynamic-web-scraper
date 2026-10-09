# Dynamic Web Scraper

A lightweight, config-driven web scraper built with JavaScript. Define what to scrape and which selectors to use—the scraper handles fetching, parsing, pagination, and saving.

**Perfect for:** scraping multiple pages from a single site, handling pagination automatically, and reusing the same scraper for similar websites.

## Features

- ✅ Config-based scraping—no code changes needed for new sites
- ✅ Automatic pagination—scrapes until no data remains
- ✅ Flexible URL patterns—supports query params, path-based, and custom pagination
- ✅ Error handling—gracefully handles HTTP errors and network timeouts
- ✅ Rate limiting—1-second delay between requests to avoid overwhelming servers
- ✅ Structured output—results saved as JSON

## Tech Stack

- **Node.js** — JavaScript runtime
- **Axios** — HTTP client for fetching pages
- **Cheerio** — Fast HTML parsing and CSS selector support
- **ES Modules** — Modern JavaScript module syntax

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure your target website in `config.js`

```javascript
export const config = {
  baseUrl: "https://www.example.com/",
  pages: ["products", "reviews"],
  paginationPattern: "?page={page}",
  selectors: {
    products: {
      container: ".product-item",
      name: ".product-name",
      price: ".product-price",
      link: "a"
    },
    reviews: {
      container: ".review",
      author: ".reviewer-name",
      rating: ".stars",
      text: ".review-text"
    }
  }
};
```

### 3. Run the scraper

```bash
node scraper.js
```

Results are saved to `data.json`.

---

## Configuration Guide

### Required Fields

**`baseUrl`** — The root URL of the website
```javascript
baseUrl: "https://www.scrapethissite.com/"
```

**`pages`** — Array of paths to scrape (appended to baseUrl)
```javascript
pages: ["pages/forms", "pages/tables"]
// Results in URLs like: https://www.scrapethissite.com/pages/forms
```

**`selectors`** — CSS selectors for data extraction, keyed by page name
```javascript
selectors: {
  "pages/forms": {
    container: ".team",        // Wrapping element for each record
    name: ".name",             // Child selector for name
    year: ".year",             // Child selector for year
    win: ".wins",              // Child selector for wins
    loss: ".losses"            // Child selector for losses
  }
}
```

### Optional Fields

**`paginationPattern`** — How to build paginated URLs. Can be a string or array of patterns.

String pattern (uses one style):
```javascript
paginationPattern: "?page_num={page}"
// Results in: base_url?page_num=1, base_url?page_num=2, etc.
```

Array of patterns (tries each until data is found):
```javascript
paginationPattern: [
  "?page_num={page}",      // Try this first
  "?page={page}",          // Then this
  "/page/{page}",          // Then this
  "?p={page}"              // Finally this
]
```

**Placeholder**: Use `{page}` as a placeholder for the page number. It's replaced with 1, 2, 3... automatically.

**Default**: If `paginationPattern` is not provided, defaults to `"?page_num={page}"`.

---

## How It Works

### Architecture Overview

```
config.js (configuration)
    ↓
scraper.js (main flow)
    ├─→ getHtml() — Fetch page HTML via Axios
    ├─→ loadCheerio() — Parse HTML into DOM structure
    ├─→ extractForms() — Extract data using CSS selectors
    ├─→ scrapeAll() — Loop through pages with pagination
    └─→ saveJSON() — Write results to data.json
```

### Step-by-Step Scraping Flow

#### Step 1: Read the configuration

```javascript
const { baseUrl, pages, selectors, paginationPattern } = config;
```

The scraper loads the website URL, pages to scrape, selectors, and pagination rules from `config.js`.

#### Step 2: Loop through each page

```javascript
for (const page of pages) {
  const url = baseUrl + page;
  const pageSelector = selectors[page];
  const data = await scrapeAll(url, pageSelector, paginationPattern);
}
```

For each page path in the config:
- Builds the full URL by combining `baseUrl` + page path
- Looks up the selector group for that page
- Scrapes all paginated results

#### Step 3: Fetch HTML

```javascript
async function getHtml(url) {
  const response = await axios.get(url, {
    timeout: 10000,
    headers: { "User-Agent": "Mozilla/5.0" },
    validateStatus: (status) => status < 500
  });
  
  if (response.status !== 200) return null;
  return response.data;
}
```

Uses Axios to fetch the page. Includes:
- **Timeout**: 10-second limit to prevent hanging
- **User-Agent**: Mimics a browser to avoid rejection
- **Error handling**: Returns `null` on HTTP errors or network failures

#### Step 4: Parse HTML with Cheerio

```javascript
const $ = cheerio.load(html);
```

Cheerio parses HTML into a jQuery-like object, making CSS selector queries fast and familiar.

#### Step 5: Extract data from the page

```javascript
function extractForms($, selectors) {
  const result = [];
  
  $(selectors.container).each((_, el) => {
    result.push({
      name: $(el).find(selectors.name).text().trim(),
      year: $(el).find(selectors.year).text().trim(),
      win: $(el).find(selectors.win).text().trim(),
      loss: $(el).find(selectors.loss).text().trim()
    });
  });
  
  return result;
}
```

For each container element:
1. Loops through all matches
2. Extracts each field using child selectors
3. Trims whitespace and returns structured data

#### Step 6: Handle pagination

```javascript
async function scrapeAll(url, selectors, paginationPattern = "?page_num={page}") {
  const allData = [];
  let page = 1;

  while (true) {
    const pageSuffix = paginationPattern.replace("{page}", String(page));
    const newUrl = `${url}${pageSuffix}`;
    const html = await getHtml(newUrl);

    if (!html) break; // Network error, stop
    
    const $ = cheerio.load(html);
    const data = extractForms($, selectors);

    if (data.length === 0) break; // No data on this page, stop
    
    allData.push(...data);
    page++;
    await delay(1000); // 1-second delay between requests
  }

  return allData;
}
```

**Pagination logic:**
1. Start at page 1
2. Replace `{page}` placeholder with current page number
3. Fetch and parse the page
4. Extract data
5. If no data found → stop (we've reached the last page)
6. Otherwise → add data, increment page counter, wait 1 second, repeat

#### Step 7: Save results

```javascript
async function saveJSON(data) {
  await fs.writeFile("data.json", JSON.stringify(data, null, 2), "utf-8");
}
```

Writes all collected data to `data.json` with pretty formatting (2-space indentation).

---

## Usage Examples

### Example 1: Single-page scraping

If you only need one page (no pagination):

```javascript
// In scraper.js, replace scrapeAll() with scrape():
const data = await scrape(url, pageSelector);
```

### Example 2: Multiple pages with different selectors

```javascript
export const config = {
  baseUrl: "https://example.com/",
  pages: ["products", "reviews", "news"],
  paginationPattern: "?page={page}",
  selectors: {
    products: { container: ".product", name: ".title", price: ".cost" },
    reviews: { container: ".review", author: ".user", rating: ".stars" },
    news: { container: ".article", title: ".headline", date: ".posted" }
  }
};
```

### Example 3: Custom pagination patterns

Different websites use different URL structures. Update `paginationPattern` to match:

```javascript
// Query parameter style (most common)
paginationPattern: "?page={page}"
// Results: base_url?page=1, base_url?page=2

// Alternative query parameter
paginationPattern: "?p={page}"
// Results: base_url?p=1, base_url?p=2

// Path-based pagination
paginationPattern: "/page/{page}"
// Results: base_url/page/1, base_url/page/2

// Multiple patterns (try first, second, third...)
paginationPattern: [
  "?page_num={page}",
  "?page={page}",
  "/page/{page}"
]
```

### Example 4: Real-world config (scraping a product listing)

```javascript
export const config = {
  baseUrl: "https://www.example-store.com/",
  pages: ["category/electronics"],
  paginationPattern: "?page={page}",
  selectors: {
    "category/electronics": {
      container: ".product-card",
      title: ".product-title",
      price: ".product-price",
      rating: ".star-rating",
      inStock: ".availability"
    }
  }
};
```

Run:
```bash
node scraper.js
```

Output (`data.json`):
```json
[
  {
    "title": "Laptop Pro 15",
    "price": "$1,299",
    "rating": "4.5",
    "inStock": "In Stock"
  },
  {
    "title": "Wireless Mouse",
    "price": "$29.99",
    "rating": "4.8",
    "inStock": "In Stock"
  }
]
```

---

## API Reference

### `getHtml(url)`
Fetches HTML from a URL. Returns the HTML string or `null` if the request fails.

### `loadCheerio(html)`
Parses HTML into a Cheerio object for CSS selector queries.

### `extractForms($, selectors)`
Extracts data from the parsed HTML using the provided selectors. Returns an array of objects.

### `scrape(url, selectors)`
Scrapes a single page (no pagination). Returns an array of extracted records.

### `scrapeAll(url, selectors, paginationPattern)`
Scrapes multiple pages using pagination. Loops until no data is returned. Returns an array of all records from all pages.

### `saveJSON(data)`
Writes the data array to `data.json` with pretty formatting.

---

## Troubleshooting

### Problem: "No data in data.json"

**Check:**
1. Is `baseUrl` correct? Visit it in your browser.
2. Are your selectors correct? Inspect the HTML and verify the CSS selectors match.
3. Is there pagination? Check if pages require a `paginationPattern`.

**Example selector debugging:**
```javascript
// Wrong (targets empty elements)
selectors: { container: ".product-item", name: ".non-existent-class" }

// Right (targets actual elements)
selectors: { container: ".product", name: ".product-name" }
```

### Problem: "Request failed" or "Non-200 response"

**Causes:**
- The website blocks requests without a proper User-Agent
- The website uses JavaScript to load content (Cheerio can't execute JS)
- The website has rate limiting or requires authentication

**Solutions:**
- Check the website's `robots.txt` and terms of service
- Use a headless browser like Puppeteer for JavaScript-heavy sites
- Add authentication headers if needed

### Problem: "Scraper hangs or runs forever"

**Causes:**
- Pagination pattern is wrong (always returns data)
- Empty page returns HTML but no matching elements

**Solutions:**
- Log page URLs to verify they're correct:
  ```javascript
  console.log("Fetching:", newUrl);
  ```
- Verify selectors with `console.log(data.length)` inside `scrapeAll()`

---

## Missing Documentation in Code

The following areas could use inline code comments:

1. **`scraper.js` line 77**: The logic for replacing `{page}` placeholder isn't clearly explained
2. **`scraper.js` line 97**: The 1-second delay and why it's needed
3. **`config.js`**: No inline documentation for the structure or field requirements
4. **Selector naming**: `extractForms()` is hardcoded for "forms" but can extract any data type

---

## Performance Notes

- **Rate limiting**: 1-second delay between requests prevents overwhelming servers
- **Timeout**: 10-second limit per request prevents hanging
- **Error resilience**: Network errors or missing pages don't crash the scraper
- **Memory**: All data is held in memory until saved; very large datasets may require streaming

---

## Limitations

1. **No JavaScript execution**: Cheerio doesn't run JavaScript. Sites that load content via JS won't work.
2. **No authentication**: Doesn't support login or session-based scraping out of the box.
3. **Single extraction function**: Currently hardcoded to extract the same data type per page.
4. **No retry logic**: Failed requests are skipped rather than retried.

---

## License

ISC

## Author

[CodeCraftedYash](https://github.com/CodeCraftedYash)