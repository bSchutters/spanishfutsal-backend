export default {
  async importRanking(ctx) {
    try {
      const service = strapi.service("api::lffs.lffs");
      await service.fetchAndStoreClassement();
      ctx.send({ message: "Classement importé avec succès" });
    } catch (error) {
      console.error("Erreur lors de l'import du classement :", error);
      ctx.throw(500, "Erreur lors de l'import du classement");
    }
  },

  async importMatchs(ctx) {
    try {
      const service = strapi.service("api::lffs.lffs");
      await service.fetchAndStoreMatchs();
      ctx.send({ message: "Matchs importés avec succès" });
    } catch (error) {
      console.error("Erreur lors de l'import des matchs :", error);
      ctx.throw(500, "Erreur lors de l'import des matchs");
    }
  },

};
