export const config = {
  baseUrl: "https://www.scrapethissite.com/",
  pages: ["pages/forms"],

  // Optional global settings for the scraper
  requestDelay: 1000,
  maxPages: 50,
  checkNextLink: true,

  // Legacy pagination config (still works for backward compatibility)
  paginationPattern: [
    "?page_num={page}",
    "?page={page}",
    "?p={page}",
    "/page/{page}",
    "/{page}"
  ],

  // Recommended: flexible pagination config (per-page or global)
  pagination: {
    default: "?page_num={page}",
    // Examples:
    // "pages/forms": "?page_num={page}",           // Query parameter
    // "pages/products": "/products/{page}",         // Path-based like /products/1, /products/2
    // "pages/items": "/item/{page}",                // Custom path like /item/1, /item/2
    // "pages/listings": {                           // Advanced: offset-based
    //   type: "offset",
    //   pattern: "?offset={offset}&limit={limit}",
    //   limit: 20
    // }
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
