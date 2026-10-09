import axios from "axios";
import * as cheerio from "cheerio";
import { config } from "./config.js";
import fs from "fs/promises";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const DEFAULT_PAGINATION_PATTERN = "?page_num={page}";
const paginationCache = new Map();

async function getHtml(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      validateStatus: (status) => status < 500,
    });

    if (response.status !== 200) {
      console.warn(`Non-200 response: ${response.status} for ${url}`);
      return null;
    }

    return response.data;
  } catch (err) {
    console.error(`Request failed for ${url}:`, err.message);
    return null;
  }
}

function loadCheerio(html) {
  return cheerio.load(html);
}

function extractLinks($, selector) {
  return $(selector)
    .map((_, el) => ({
      text: $(el).text().trim(),
      href: $(el).attr("href"),
    }))
    .get();
}

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

/**
 * Normalize pagination config into a standard format
 * Supports: string, array, or object with type and pattern
 */
function normalizePaginationConfig(paginationConfig, fallbackPattern = DEFAULT_PAGINATION_PATTERN) {
  if (!paginationConfig) {
    return { type: "page", pattern: fallbackPattern };
  }

  if (typeof paginationConfig === "string") {
    return { type: "page", pattern: paginationConfig };
  }

  if (Array.isArray(paginationConfig)) {
    return { type: "page", patterns: paginationConfig };
  }

  if (paginationConfig.pattern || paginationConfig.type) {
    return {
      ...paginationConfig,
      type: paginationConfig.type || "page",
      pattern: paginationConfig.pattern || fallbackPattern,
    };
  }

  return { type: "page", pattern: fallbackPattern };
}

/**
 * Build a paginated URL based on the pagination config
 * Supports query params, path-based, and offset-based pagination
 */
function buildPaginationUrl(baseUrl, paginationConfig, pageNumber) {
  const config = normalizePaginationConfig(paginationConfig, DEFAULT_PAGINATION_PATTERN);

  if (config.type === "offset") {
    const limit = config.limit || 20;
    const offset = (pageNumber - 1) * limit;
    return `${baseUrl}${config.pattern
      .replace("{offset}", String(offset))
      .replace("{limit}", String(limit))
      .replace("{page}", String(pageNumber))}`; // Support {page} even in offset mode
  }

  // Query-param or path-based (both use {page} placeholder)
  const pattern = config.pattern || config.default || DEFAULT_PAGINATION_PATTERN;
  return `${baseUrl}${pattern
    .replace("{page}", String(pageNumber))
    .replace("{offset}", String((pageNumber - 1) * (config.limit || 20)))
    .replace("{limit}", String(config.limit || 20))}`; // Support offset placeholders in query/path too
}

/**
 * Find a working pagination pattern from a list of candidates
 * Caches the result to avoid repeated attempts
 */
async function findWorkingPaginationPattern(baseUrl, paginationConfig, key) {
  const cacheKey = `${key}:${JSON.stringify(paginationConfig)}`;

  if (paginationCache.has(cacheKey)) {
    return paginationCache.get(cacheKey);
  }

  const candidates = [];

  if (Array.isArray(paginationConfig)) {
    candidates.push(...paginationConfig);
  } else if (typeof paginationConfig === "string") {
    candidates.push(paginationConfig);
  } else if (paginationConfig?.pattern) {
    candidates.push(paginationConfig.pattern);
  } else {
    candidates.push(DEFAULT_PAGINATION_PATTERN);
  }

  for (const candidate of candidates) {
    const testUrl = `${baseUrl}${candidate
      .replace("{page}", "1")
      .replace("{offset}", "0")
      .replace("{limit}", "20")}`; 

    const html = await getHtml(testUrl);
    if (html) {
      const result = normalizePaginationConfig({ pattern: candidate, type: "page" });
      paginationCache.set(cacheKey, result);
      console.log(`✓ Found working pattern: ${candidate}`);
      return result;
    }
  }

  const fallback = normalizePaginationConfig(DEFAULT_PAGINATION_PATTERN);
  paginationCache.set(cacheKey, fallback);
  console.warn(`⚠ No working pagination pattern found, using fallback`);
  return fallback;
}

/**
 * Check if a "Next" link exists on the page
 */
function hasNextLink($) {
  const nextSelector = [
    "a[rel='next']",
    "a.next",
    ".pagination a:last-child",
    "a[aria-label*='Next']",
    "a[title*='Next']"
  ].join(",");

  return $(nextSelector).length > 0;
}

async function scrape(url, selectors) {
  try {
    const html = await getHtml(url);
    if (!html) return [];

    const $ = loadCheerio(html);
    return extractForms($, selectors);
  } catch (err) {
    console.log("Scrape error:", err);
    return [];
  }
}

/**
 * Scrape all pages following pagination rules
 * @param {string} url - Base URL for this page
 * @param {object} selectors - CSS selectors for extraction
 * @param {string|array|object} paginationConfig - Pagination strategy
 * @param {object} options - Additional options (requestDelay, maxPages, checkNextLink)
 */
async function scrapeAll(url, selectors, paginationConfig = DEFAULT_PAGINATION_PATTERN, options = {}) {
  const allData = [];
  const seenData = new Set();
  const requestDelay = options.requestDelay ?? 1000;
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const checkNextLink = options.checkNextLink ?? false;

  try {
    const workingPattern = await findWorkingPaginationPattern(url, paginationConfig, url);
    let page = 1;
    let consecutiveEmptyPages = 0;

    while (page <= maxPages) {
      const paginatedUrl = buildPaginationUrl(url, workingPattern, page);
      console.log(`[Page ${page}] Fetching: ${paginatedUrl}`);
      const html = await getHtml(paginatedUrl);

      if (!html) {
        consecutiveEmptyPages += 1;
        console.warn(`⚠ No HTML returned for page ${page}`);
        if (consecutiveEmptyPages >= 2) {
          console.log("Stopping: multiple empty responses in a row");
          break;
        }
        page++;
        continue;
      }

      const $ = loadCheerio(html);
      const data = extractForms($, selectors);

      if (data.length === 0) {
        consecutiveEmptyPages += 1;
        console.log(`ℹ No data found on page ${page}`);
        if (consecutiveEmptyPages >= 2) {
          console.log("Stopping: no data found on consecutive pages");
          break;
        }
        page++;
        await delay(requestDelay);
        continue;
      }

      consecutiveEmptyPages = 0;
      const dataSignature = JSON.stringify(data);

      if (seenData.has(dataSignature)) {
        console.log("Stopping: duplicate page data detected");
        break;
      }

      seenData.add(dataSignature);
      allData.push(...data);
      console.log(`✓ Page ${page}: ${data.length} records extracted`);

      if (checkNextLink && !hasNextLink($)) {
        console.log("Stopping: no next-page link found");
        break;
      }

      page++;
      await delay(requestDelay);
    }

    console.log(`✓ Total: ${allData.length} records from ${page - 1} pages\n`);
    return allData;
  } catch (err) {
    console.log("Scrape error:", err.message);
    return allData;
  }
}

async function saveJSON(data) {
  await fs.writeFile("data.json", JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Resolve the pagination config for a specific page
 * Checks the new pagination object first, then falls back to paginationPattern
 */
function resolvePagePagination(pageName, config) {
  if (config.pagination && typeof config.pagination === "object" && !Array.isArray(config.pagination)) {
    if (config.pagination[pageName]) {
      return config.pagination[pageName];
    }

    if (config.pagination.default) {
      return config.pagination.default;
    }
  }

  return config.paginationPattern || DEFAULT_PAGINATION_PATTERN;
}

async function main() {
  const { baseUrl, pages, selectors, paginationPattern, pagination, requestDelay, maxPages, checkNextLink } = config;

  if (!(baseUrl && pages && selectors)) {
    console.log("Config missing");
    return;
  }

  const allData = [];

  for (const page of pages) {
    const url = baseUrl + page;
    const pageSelector = selectors[page];
    if (!pageSelector) continue;

    console.log(`\n📄 Scraping: ${page}`);
    const pagePagination = resolvePagePagination(page, config);
    const data = await scrapeAll(url, pageSelector, pagePagination, {
      requestDelay: requestDelay ?? 1000,
      maxPages: maxPages ?? Number.POSITIVE_INFINITY,
      checkNextLink: checkNextLink ?? false,
    });

    allData.push(...data);
    await delay(requestDelay ?? 1000);
  }

  await saveJSON(allData);
  console.log(allData);
  console.log("Done");
}

main();
