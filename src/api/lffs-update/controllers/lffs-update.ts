export default {
  async getAllUpdates(ctx) {
    try {
      const updates = await strapi.db
        .query("api::lffs-update.lffs-update")
        .findMany({
          orderBy: { updatedAt: "desc" },
        });

      ctx.body = updates;
    } catch (error) {
      ctx.throw(500, "Erreur lors de la récupération des mises à jour");
    }
  },
};
