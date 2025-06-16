import axios from "axios";
import { getPublicAccessToken } from "../../../utils/getAccessTokenFromSite";
import { upsertLffsUpdate } from "../../../utils/upsertLffsUpdate";
import { format, parse } from "date-fns";

const BASE_URL = "https://gestion.lffs.eu/lms_league_ws/public/api/v1";

export default ({ strapi }: { strapi: any }) => ({
  async fetchAndStoreMatchs() {
    const [season] = await strapi.entityService.findMany("api::season.season", {
      filters: { active: true },
      limit: 1,
    });

    if (!season) {
      console.log("❌ Aucune saison active trouvée.");
      return;
    }

    const token = await getPublicAccessToken();
    const url = `${BASE_URL}/game/byMyLeague?season_id=${season.season_id}&club_id=5066`;

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
      return;
    }

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

      const data: any = {
        home_team: game.home_team_name,
        away_team: game.away_team_name,
        score_home: game.home_score,
        score_away: game.away_score,
        venue_id: game.venue_id,
        venue_name: game.venue_name,
        serie_reference: game.serie_reference,
        season: season.id,
      };
      if (game.date) data.date = game.date;
      if (game.time) data.time = game.time;

      if (existing) {
        await strapi.db.query("api::match.match").update({
          where: { id: existing.id },
          data,
        });
      } else {
        await strapi.db.query("api::match.match").create({ data });
      }
    }

    await strapi.db.query("api::lffs-update.lffs-update").updateMany({
      where: { type: "matches" },
      data: { updatedAt: new Date() },
    });

    await upsertLffsUpdate("matches");
    console.log("✅ Matchs importés avec succès.");
  },

  async fetchAndStoreClassement() {
    console.log("🚀 Lancement de l'import du classement...");

    const [season] = await strapi.entityService.findMany("api::season.season", {
      filters: { active: true },
      limit: 1,
    });

    if (!season) {
      console.log("❌ Aucune saison active trouvée.");
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

    // Importer les nouvelles données
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

      console.log("pos", positionChange + team.team_name);
      console.log("prevPost", previousPosition + team.team_name);

      await strapi.db.query("api::ranking.ranking").create({
        data: {
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
        },
      });
    }

    await upsertLffsUpdate("ranking");
    console.log("✅ Classement importé avec succès.");
  },
});
