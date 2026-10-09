export const config = {
  baseUrl: "https://www.scrapethissite.com/",
  pages: ["pages/forms"],

  // Optional global settings for the scraper
  requestDelay: 1000,
  maxPages: 50,
  checkNextLink: true,

  // Backward-compatible pagination config
  paginationPattern: [
    "?page_num={page}",
    "?page={page}",
    "?p={page}",
    "/page/{page}"
  ],

  // New flexible pagination config (preferred)
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
