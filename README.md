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
- optionally keeps scraping paginated pages until no more results are found
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
- `selectors`: the CSS selectors used for each page

Each entry in `selectors` is mapped to a page path. The script uses that page name to find the correct selector group.

## Step-by-step scraping flow

### 1. Read the config

In `main()`, the scraper reads:

```javascript
const { baseUrl, pages, selectors } = config;
```

This gives the scraper the website URL, page list, and extraction rules.

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

The scraper supports paginated websites through `scrapeAll()`.

```javascript
async function scrapeAll(url, selectors) {
  const allData = [];
  let page = 1;

  while (true) {
    const newUrl = `${url}?page_num=${page}`;
    const html = await getHtml(newUrl);
    const $ = loadCheerio(html);
    const data = extractForms($, selectors);

    if (data.length === 0) {
      break;
    }

    allData.push(...data);
    page++;
    await delay(1000);
  }

  return allData;
}
```

This means:
- it requests page 1, then page 2, then page 3...
- it keeps going until the page returns no data
- when empty, it stops scraping

That is how the project handles pagination without hardcoding page numbers.

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

In `main()`, the scraper is set to paginate by default:

```javascript
const data = await scrapeAll(url, pageSelector);
```

If you want to scrape only a single page, you can switch to:

```javascript
const data = await scrape(url, pageSelector);
```

This is useful when the page does not have a pagination pattern or you only need one page of data.

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

## Summary

This repo is a lightweight scraping starter where configuration drives the work. Instead of writing custom logic for every page, you define the target page and selectors once, and the scraper handles fetching, parsing, pagination, and saving results.

That makes it easy to reuse for many similar sites without creating a complicated framework.
