import axios from "axios";
import * as cheerio from "cheerio";
import { config } from "./config.js";
import fs from "fs/promises";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function getHtml(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0",
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

/**
 * Extract text from an element using either:
 * 1. CSS selector: ".class-name", "#id", "div > span"
 * 2. Child path: "children[0].children[1].text" or "children[0].children[0].innerText"
 */
function extractText($, element, selector) {
  if (!selector) return "";

  // If it looks like a child path (contains "children[")
  if (typeof selector === "string" && selector.includes("children[")) {
    try {
      // Parse the path like "children[0].children[1].text"
      const parts = selector.match(/children\[\d+\]|\.?\w+/g) || [];
      let current = element;

      for (const part of parts) {
        if (part.startsWith("children[")) {
          const index = parseInt(part.match(/\d+/)[0]);
          current = current.children?.[index];
        } else if (part === ".text" || part === "text") {
          return $(current).text().trim();
        } else if (part === ".innerText" || part === "innerText") {
          return $(current).text().trim(); // Cheerio uses text() for innerText
        } else if (part.startsWith(".")) {
          current = current[part.slice(1)];
        }

        if (!current) return "";
      }

      // If we ended at an element, get its text
      return $(current).text().trim();
    } catch (err) {
      console.warn(`Error parsing child path: ${selector}`, err.message);
      return "";
    }
  }

  // Otherwise treat it as a CSS selector
  return $(element).find(selector).text().trim();
}

/**
 * Extract data from the page
 * Supports both CSS selectors and child path notation
 * 
 * Example selector config:
 * {
 *   container: ".listing-item",
 *   name: "children[0].children[0].text",  // child path
 *   location: ".location",                 // CSS selector
 *   price: "children[0].children[2].innerText" // child path
 * }
 */
function extractForms($, selectors) {
  const result = [];

  $(selectors.container).each((_, el) => {
    const record = {};

    // Extract all fields from selectors
    for (const [key, selector] of Object.entries(selectors)) {
      if (key === "container") continue; // Skip container itself

      record[key] = extractText($, el, selector);
    }

    result.push(record);
  });

  return result;
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

async function scrapeAll(url, selectors, paginationPattern = "?page_num={page}") {
  const allData = [];

  try {
    let page = 1;

    while (true) {
      const pageSuffix = paginationPattern.replace("{page}", String(page));
      const newUrl = `${url}${pageSuffix}`;
      console.log(`[Page ${page}] Fetching: ${newUrl}`);
      
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
      console.log(`✓ Page ${page - 1}: ${data.length} records extracted`);
      await delay(1000);
    }

    return allData;
  } catch (err) {
    console.log("Scrape error:", err.message);
    return [];
  }
}

async function saveJSON(data) {
  await fs.writeFile("data.json", JSON.stringify(data, null, 2), "utf-8");
}

async function main() {
  const { baseUrl, pages, selectors, paginationPattern } = config;

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
    const data = await scrapeAll(url, pageSelector, paginationPattern || "?page_num={page}");
    allData.push(...data);

    await delay(1000);
  }

  await saveJSON(allData);
  console.log("\n✅ Done! Data saved to data.json");
  console.log(allData);
}

main();
