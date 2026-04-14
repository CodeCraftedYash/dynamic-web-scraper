export const config = {
  baseUrl: "https://www.scrapethissite.com/",
  pages : [
    "pages/forms"
  ],
  selectors : {
    "pages/forms":{
      container:".team",
      name:".name",
      year:".year",
      win:".wins",
      loss:".losses"
    }
  }
};