import cron from "node-cron";
import createLffsService from "./api/lffs/services/lffs";

export default {
  register() {},

  bootstrap({ strapi }) {
    const lffsService = createLffsService({ strapi });

    // Fonction utilitaire pour vérifier si l'auto-import est activé
    async function isAutoImportEnabled() {
      try {
        const settings = await strapi.entityService.findSingleton(
          "api::setting.setting",
          {
            limit: 1,
          }
        );

        // Si settings n'existe pas ou n'a pas le champ, on le considère désactivé
        const enabled = settings?.imports === true;

        console.log(`⚙️ Auto-import enabled ? → ${enabled}`);
        return enabled;
      } catch (err) {
        console.error(
          "❌ Impossible de récupérer le paramètre autoImportEnabled :",
          err
        );
        return false;
      }
    }

    // CRON global toutes les 3 heures
    cron.schedule("0 */3 * * *", async () => {
      if (!(await isAutoImportEnabled())) {
        console.log("⏸️ Auto-import désactivé → skip CRON global");
        return;
      }

      console.log("⏰ Tâche CRON - Import automatique des données LFFS");

      try {
        await lffsService.fetchAndStoreClassement();
        await lffsService.fetchAndStoreMatchs();
        console.log("✅ Import automatique terminé !");
      } catch (err) {
        console.error("❌ Erreur lors de l'import automatique :", err);
      }
    });

    // Fonction pour planifier les CRON post-match
    const scheduledCrons = new Set<string>();

    async function scheduleMatchesPostUpdate() {
      if (!(await isAutoImportEnabled())) {
        console.log("⏸️ Auto-import désactivé → skip planification post-match");
        return;
      }

      console.log(
        "🔍 Recherche des matchs pour planifier les CRON post-match..."
      );

      const matches = await strapi.entityService.findMany("api::match.match", {
        filters: {
          date: { $notNull: true },
          time: { $notNull: true },
        },
        sort: ["date:asc", "time:asc"],
        limit: 1000,
      });

      console.log(`🔍 ${matches.length} matchs trouvés pour planification.`);

      matches.forEach((match) => {
        const dateStr = match.date;
        const timeStr = match.time;

        if (!dateStr || !timeStr) return;

        const matchDateTime = new Date(`${dateStr}T${timeStr}`);

        if (isNaN(matchDateTime.getTime())) {
          console.warn(
            `⛔ Date invalide pour le match ${match.home_team} vs ${match.away_team}`
          );
          return;
        }

        const postMatchDate = new Date(
          matchDateTime.getTime() + 70 * 60 * 1000
        );
        const now = new Date();
        if (postMatchDate <= now) {
          console.log(
            `⏩ Skip post-update pour match déjà passé : ${match.home_team} vs ${match.away_team}`
          );
          return;
        }

        const minutes = postMatchDate.getMinutes();
        const hours = postMatchDate.getHours();
        const day = postMatchDate.getDate();
        const month = postMatchDate.getMonth() + 1;

        const cronExpression = `${minutes} ${hours} ${day} ${month} *`;

        const cronKey = `${match.id}-${cronExpression}`;
        if (scheduledCrons.has(cronKey)) {
          return;
        }

        console.log(
          `🕑 Programmation CRON post-match pour le ${postMatchDate.toString()} → ${cronExpression}`
        );

        cron.schedule(cronExpression, async () => {
          if (!(await isAutoImportEnabled())) {
            console.log("⏸️ Auto-import désactivé → skip import post-match");
            return;
          }

          console.log(
            `🚀 [MATCH POST-UPDATE] Import après match : ${match.home_team} vs ${match.away_team}`
          );

          try {
            await lffsService.fetchAndStoreMatchs();
            await lffsService.fetchAndStoreClassement();
            console.log("✅ [MATCH POST-UPDATE] Import terminé !");
          } catch (err) {
            console.error("❌ Erreur lors de l'import post-match :", err);
          }
        });

        scheduledCrons.add(cronKey);
      });
    }

    // Planification initiale au démarrage
    scheduleMatchesPostUpdate();

    // Refresh des CRON post-match toutes les 5 minutes
    cron.schedule("*/2 * * * *", async () => {
      console.log("🔄 Refresh des CRON post-match (toutes les 5 min)");
      await scheduleMatchesPostUpdate();
    });
  },
};
