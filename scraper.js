  import axios from "axios";
  import * as cheerio from "cheerio";
  import { config } from "./config.js";
  import fs from "fs/promises";
  import { error } from "console";

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  async function getHtml(url) {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      validateStatus: (status) => status < 500, // allow 4xx, block 5xx
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

  function loadCheerio (html) {
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

    // choose extractor based on structure
    return extractForms($, selectors);

  } catch (err) {
    console.log("Scrape error:", err);
    return [];
  }
}

  async function saveJSON(data) {
    await fs.writeFile(
      "data.json",
      JSON.stringify(data, null, 2),
      "utf-8"
    );
}

  async function main() {
  const { baseUrl, pages, selectors } = config;

  if (!(baseUrl && pages && selectors)) {
    console.log("Config missing");
    return;
  }

  const allData = [];

  for (const page of pages) {
    const url = baseUrl + page;

    const pageSelector = selectors[page];
    if (!pageSelector) continue;

    const data = await scrape(url, pageSelector);

    allData.push(...data);

    await delay(1000); 
  }

  await saveJSON(allData);
  console.log(allData);
  console.log("Done");
}

  main();