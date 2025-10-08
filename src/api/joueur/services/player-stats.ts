/**
 * Service pour calculer les statistiques globales d'un joueur
 */

export default ({ strapi }: { strapi: any }) => ({
  /**
   * Calcule les statistiques globales d'un joueur pour une saison donnée
   * @param playerId - ID du joueur
   * @param seasonId - ID de la saison (optionnel, si non fourni = saison active)
   */
  async getPlayerStats(playerId: number | string, seasonId?: number | string) {
    try {
      // Si pas de saison fournie, on prend la saison active
      let targetSeasonId = seasonId;
      if (!targetSeasonId) {
        const [activeSeason] = await strapi.entityService.findMany("api::season.season", {
          filters: { active: true },
          limit: 1,
        });
        if (!activeSeason) {
          throw new Error("Aucune saison active trouvée");
        }
        targetSeasonId = activeSeason.id;
      }

      // Récupérer tous les matchs de la saison avec les stats du joueur
      const matches = await strapi.db.query("api::match.match").findMany({
        where: { season: targetSeasonId },
        populate: {
          field_players_stats: {
            populate: ["joueur"],
          },
          goalkeeper_stats: {
            populate: ["joueur"],
          },
        },
      });

      // Initialiser les stats
      const stats = {
        matchesPlayed: 0,
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        cleanSheets: 0,
        isGoalkeeper: false,
      };

      // Parcourir tous les matchs pour agréger les stats
      for (const match of matches) {
        // Vérifier dans les stats des joueurs de champ
        if (match.field_players_stats) {
          const playerStat = match.field_players_stats.find(
            (stat: any) => stat.joueur?.id === Number(playerId)
          );
          if (playerStat) {
            stats.matchesPlayed++;
            stats.goals += playerStat.goals || 0;
            stats.assists += playerStat.assists || 0;
            stats.yellowCards += playerStat.yellow_cards || 0;
            stats.redCards += playerStat.red_cards || 0;
          }
        }

        // Vérifier dans les stats des gardiens
        if (match.goalkeeper_stats) {
          const goalkeeperStat = match.goalkeeper_stats.find(
            (stat: any) => stat.joueur?.id === Number(playerId)
          );
          if (goalkeeperStat) {
            stats.matchesPlayed++;
            stats.isGoalkeeper = true;
            stats.goals += goalkeeperStat.goals || 0;
            stats.assists += goalkeeperStat.assists || 0;
            stats.cleanSheets += goalkeeperStat.clean_sheet ? 1 : 0;
            stats.yellowCards += goalkeeperStat.yellow_cards || 0;
            stats.redCards += goalkeeperStat.red_cards || 0;
          }
        }
      }

      return {
        playerId,
        seasonId: targetSeasonId,
        ...stats,
      };
    } catch (error) {
      console.error("Erreur lors du calcul des stats du joueur:", error);
      throw error;
    }
  },

  /**
   * Récupère les stats détaillées match par match pour un joueur
   * @param playerId - ID du joueur
   * @param seasonId - ID de la saison (optionnel)
   */
  async getPlayerMatchStats(playerId: number | string, seasonId?: number | string) {
    try {
      let targetSeasonId = seasonId;
      if (!targetSeasonId) {
        const [activeSeason] = await strapi.entityService.findMany("api::season.season", {
          filters: { active: true },
          limit: 1,
        });
        if (!activeSeason) {
          throw new Error("Aucune saison active trouvée");
        }
        targetSeasonId = activeSeason.id;
      }

      const matches = await strapi.db.query("api::match.match").findMany({
        where: { season: targetSeasonId },
        populate: {
          field_players_stats: {
            populate: ["joueur"],
          },
          goalkeeper_stats: {
            populate: ["joueur"],
          },
        },
        orderBy: { date: "desc" },
      });

      const matchStats = [];

      for (const match of matches) {
        let playerStat = null;
        let isGoalkeeper = false;

        // Chercher dans les stats joueurs
        if (match.field_players_stats) {
          playerStat = match.field_players_stats.find(
            (stat: any) => stat.joueur?.id === Number(playerId)
          );
        }

        // Chercher dans les stats gardiens
        if (!playerStat && match.goalkeeper_stats) {
          playerStat = match.goalkeeper_stats.find(
            (stat: any) => stat.joueur?.id === Number(playerId)
          );
          if (playerStat) {
            isGoalkeeper = true;
          }
        }

        // Si le joueur a participé à ce match
        if (playerStat) {
          matchStats.push({
            matchId: match.id,
            date: match.date,
            homeTeam: match.home_team,
            awayTeam: match.away_team,
            scoreHome: match.score_home,
            scoreAway: match.score_away,
            isGoalkeeper,
            stats: playerStat,
          });
        }
      }

      return matchStats;
    } catch (error) {
      console.error("Erreur lors de la récupération des stats match par match:", error);
      throw error;
    }
  },
});
