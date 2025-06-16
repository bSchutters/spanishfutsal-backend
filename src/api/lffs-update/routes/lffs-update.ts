export default {
  routes: [
    {
      method: "GET",
      path: "/lffs-update",
      handler: "lffs-update.getAllUpdates",
      config: {
        auth: false,
      },
    },
  ],
};
