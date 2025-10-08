/**
 * joueur controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::joueur.joueur', ({ strapi }) => ({
  /**
   * GET /api/joueurs-with-stats
   * Retourne tous les joueurs avec leurs stats globales pour la saison active (ou spécifiée)
   */
  async findWithStats(ctx: any) {
    try {
      const { seasonId } = ctx.query;

      // Récupérer la saison cible
      let targetSeasonId = seasonId;
      if (!targetSeasonId) {
        const [activeSeason] = await strapi.entityService.findMany("api::season.season", {
          filters: { active: true },
          limit: 1,
        });
        if (!activeSeason) {
          return ctx.badRequest("Aucune saison active trouvée");
        }
        targetSeasonId = activeSeason.id;
      }

      // Récupérer tous les joueurs actifs
      const players = await strapi.entityService.findMany("api::joueur.joueur", {
        filters: { actif: true },
        populate: ["photo"],
      });

      // Pour chaque joueur, calculer ses stats
      const playersWithStats = await Promise.all(
        players.map(async (player: any) => {
          try {
            const stats = await strapi
              .service("api::joueur.player-stats")
              .getPlayerStats(player.id, targetSeasonId);

            return {
              id: player.id,
              documentId: player.documentId,
              nom: player.nom,
              prenom: player.prenom,
              numero: player.numero,
              poste: player.poste,
              photo: player.photo,
              date_naissance: player.date_naissance,
              capitaine: player.capitaine,
              actif: player.actif,
              stats: {
                matchesPlayed: stats.matchesPlayed,
                goals: stats.goals,
                assists: stats.assists,
                yellowCards: stats.yellowCards,
                redCards: stats.redCards,
                cleanSheets: stats.cleanSheets,
                isGoalkeeper: stats.isGoalkeeper,
              },
            };
          } catch (error) {
            console.error(`Erreur stats pour joueur ${player.id}:`, error);
            // En cas d'erreur, retourner le joueur avec des stats vides
            return {
              ...player,
              stats: {
                matchesPlayed: 0,
                goals: 0,
                assists: 0,
                yellowCards: 0,
                redCards: 0,
                cleanSheets: 0,
                isGoalkeeper: false,
              },
            };
          }
        })
      );

      ctx.body = playersWithStats;
    } catch (error) {
      console.error("Erreur dans findWithStats:", error);
      ctx.throw(500, error);
    }
  },

  /**
   * GET /api/joueurs/:id/match-stats
   * Retourne les stats détaillées match par match pour un joueur
   */
  async getMatchStats(ctx: any) {
    try {
      const { id } = ctx.params;
      const { seasonId } = ctx.query;

      const matchStats = await strapi
        .service("api::joueur.player-stats")
        .getPlayerMatchStats(id, seasonId);

      ctx.body = matchStats;
    } catch (error) {
      console.error("Erreur dans getMatchStats:", error);
      ctx.throw(500, error);
    }
  },
}));
