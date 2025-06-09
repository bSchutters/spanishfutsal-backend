export default {
  type: "content-api",
  routes: [
    {
      method: "GET",
      path: "/lffs/import-ranking",
      handler: "lffs.importRanking",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/lffs/import-matchs",
      handler: "lffs.importMatchs",
      config: {
        auth: false,
      },
    },
  ],
};
