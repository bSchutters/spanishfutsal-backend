import axios from "axios";
import { getPublicAccessToken } from "../../../utils/getAccessTokenFromSite";
import { upsertLffsUpdate } from "../../../utils/upsertLffsUpdate";

const BASE_URL = "https://gestion.lffs.eu/lms_league_ws/public/api/v1";

export default ({ strapi }: { strapi: any }) => ({
  async fetchAndStoreMatchs() {
    try {
      await upsertLffsUpdate("matches", { status: "in_progress" });
      
      const [season] = await strapi.entityService.findMany("api::season.season", {
        filters: { active: true },
        limit: 1,
      });

      if (!season) {
        console.log("❌ Aucune saison active trouvée.");
        await upsertLffsUpdate("matches", { 
          status: "error", 
          error_message: "Aucune saison active trouvée" 
        });
        return;
      }

      const token = await getPublicAccessToken();
      const url = `${BASE_URL}/game/byMyLeague?season_id=${season.season_id}&club_id=5075`;

      const res = await axios.get(url, {
        headers: {
          Authorization: `WP_Access ${token}`,
          Origin: "https://www.lffs.eu",
          Referer: "https://www.lffs.eu/",
        },
      });

      const matchs = Array.isArray(res.data.elements) ? res.data.elements : [];

      if (matchs.length === 0) {
        console.warn("⚠️ Aucun match récupéré depuis l'API.");
        await upsertLffsUpdate("matches", { 
          status: "success", 
          items_processed: 0 
        });
        return;
      }

      let created = 0;
      let updated = 0;
      
      for (const game of matchs) {
      console.log(
        "➡️ Match détecté :",
        game.home_team_name,
        "vs",
        game.away_team_name
      );

      const whereClause: any = {
        home_team: game.home_team_name,
        away_team: game.away_team_name,
        season: season.id,
      };
      if (game.date) whereClause.date = game.date;
      if (game.time) whereClause.time = game.time;

      const existing = await strapi.db.query("api::match.match").findOne({
        where: whereClause,
      });

      function normalizeSerieReference(raw: string): "COUPE" | "P4G" {
        const coupeCodes = ["BTCPRES", "BTCPPRM"];
        return coupeCodes.includes(raw) ? "COUPE" : "P4G";
      }
      const data: any = {
        home_team: game.home_team_name,
        away_team: game.away_team_name,
        score_home: game.home_score,
        score_away: game.away_score,
        venue_id: game.venue_id,
        venue_name: game.venue_name,
        serie_reference: normalizeSerieReference(game.serie_reference),
        season: season.id,
      };
      if (game.date) data.date = game.date;
      if (game.time) data.time = game.time;

      if (existing) {
        await strapi.db.query("api::match.match").update({
          where: { id: existing.id },
          data,
        });
        updated++;
      } else {
        await strapi.db.query("api::match.match").create({ data });
        created++;
      }
      }

      await upsertLffsUpdate("matches", { 
        status: "success", 
        items_processed: created + updated 
      });
      console.log(`✅ Matchs importés avec succès. créés=${created}, mis à jour=${updated}`);
      
    } catch (error) {
      console.error("❌ Erreur lors de l'import des matchs:", error);
      await upsertLffsUpdate("matches", { 
        status: "error", 
        error_message: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  },

  async fetchAndStoreClassement() {
    try {
      await upsertLffsUpdate("ranking", { status: "in_progress" });
      
      console.log("🚀 Lancement de l'import du classement...");

      const [season] = await strapi.entityService.findMany("api::season.season", {
        filters: { active: true },
        limit: 1,
      });

      if (!season) {
        console.log("❌ Aucune saison active trouvée.");
        await upsertLffsUpdate("ranking", { 
          status: "error", 
          error_message: "Aucune saison active trouvée" 
        });
        return;
      }

      const token = await getPublicAccessToken();
      const url = `${BASE_URL}/ranking/byMyLeague?serie_id=${season.serie_id}`;

      const res = await axios.get(url, {
        headers: {
          Authorization: `WP_Access ${token}`,
          Origin: "https://www.lffs.eu",
          Referer: "https://www.lffs.eu/",
        },
      });

      const rankings = Array.isArray(res.data.elements)
        ? res.data.elements
        : res.data;

      if (!Array.isArray(rankings)) {
        console.error("❌ Format inattendu pour le classement :", res.data);
        await upsertLffsUpdate("ranking", { 
          status: "error", 
          error_message: "Format inattendu pour le classement" 
        });
        return;
      }

    // On récupère le dernier classement en base (dernière importation)
    const lastRankings = await strapi.db
      .query("api::ranking.ranking")
      .findMany({
        where: { season: season.id },
        orderBy: { imported_at: "desc" },
      });

    // Construire une map [team_name → team] du dernier classement
    const lastRankingMap = new Map<string, any>();
    for (const entry of lastRankings) {
      if (!lastRankingMap.has(entry.team_name)) {
        lastRankingMap.set(entry.team_name, entry);
      }
    }

    // Vérifier si le classement a changé
    let hasChanged = false;
    for (const team of rankings) {
      const previous = lastRankingMap.get(team.team_name);

      if (
        !previous || // équipe nouvelle
        previous.position !== team.position ||
        previous.points !== team.points ||
        previous.wins !== team.wins ||
        previous.losses !== team.losses ||
        previous.draws !== team.draws ||
        previous.goals_for !== team.score_for ||
        previous.goals_against !== team.score_against
      ) {
        hasChanged = true;
        break; // dès qu’on détecte un changement on sort
      }
    }

    if (!hasChanged) {
      console.log("⚠️ Classement identique → import ignoré.");
      await upsertLffsUpdate("ranking", { 
        status: "success", 
        items_processed: 0 
      });
      return;
    }

    console.log(
      "🔄 Changement détecté → enregistrement du nouveau classement."
    );

    // On reconstitue la map team_name → position précédente pour le calcul positionChange
    const previousPositions = new Map<string, number>();
    for (const entry of lastRankings) {
      if (!previousPositions.has(entry.team_name)) {
        previousPositions.set(entry.team_name, entry.position);
      }
    }

    // Mettre à jour les données du classement
    for (const team of rankings) {
      const goal_difference = team.score_for - team.score_against;
      const previousPosition = previousPositions.get(team.team_name);

      let positionChange: "no_change" | "up" | "down" | null = null;
      if (typeof previousPosition === "number") {
        if (previousPosition > team.position) {
          positionChange = "up"; // a gagné des places
        } else if (previousPosition < team.position) {
          positionChange = "down"; // a perdu des places
        } else {
          positionChange = "no_change"; // inchangé
        }
      }

      // Chercher si cette équipe existe déjà pour cette saison
      const existingRanking = await strapi.db.query("api::ranking.ranking").findOne({
        where: { 
          team_name: team.team_name,
          season: season.id 
        },
      });

      const rankingData = {
        team_name: team.team_name,
        played: team.played,
        points: team.points,
        wins: team.wins,
        losses: team.losses,
        draws: team.draws,
        goals_for: team.score_for,
        goals_against: team.score_against,
        goal_difference,
        position: team.position,
        result_sequence: team.result_sequence,
        season: season.id,
        imported_at: new Date(),
        positionChange,
      };

      if (existingRanking) {
        await strapi.db.query("api::ranking.ranking").update({
          where: { id: existingRanking.id },
          data: rankingData,
        });
      } else {
        await strapi.db.query("api::ranking.ranking").create({
          data: rankingData,
        });
      }
    }

    await upsertLffsUpdate("ranking", { 
      status: "success", 
      items_processed: inserted 
    });
    console.log(`✅ Classement importé avec succès. lignes=${inserted}`);
    
    } catch (error) {
      console.error("❌ Erreur lors de l'import du classement:", error);
      await upsertLffsUpdate("ranking", { 
        status: "error", 
        error_message: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  },
});
