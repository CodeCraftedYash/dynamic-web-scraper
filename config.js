export const config = {
  baseUrl: "https://www.scrapethissite.com/",
  pages: [
    "pages/forms"
  ],
  paginationPattern: "?page_num={page}",
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
