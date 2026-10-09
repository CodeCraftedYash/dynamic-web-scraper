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

async function scrape(url, selectors) {
  try {
    const html = await getHtml(url);
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

    const data = await scrapeAll(url, pageSelector, paginationPattern || "?page_num={page}");
    allData.push(...data);

    await delay(1000);
  }

  await saveJSON(allData);
  console.log(allData);
  console.log("Done");
}

main();
