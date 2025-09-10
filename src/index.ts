import cron from "node-cron";
import createLffsService from "./api/lffs/services/lffs";

export default {
  register() {},

  bootstrap({ strapi }) {
    const lffsService = createLffsService({ strapi });
    const _strapi = strapi;
    // Fonction utilitaire pour vérifier si l'auto-import est activé
    async function isAutoImportEnabled() {
      try {
        const settings = await _strapi.entityService.findMany(
          "api::setting.setting",
          {
            limit: 1,
          }
        );

        const enabled = Array.isArray(settings)
          ? settings[0].imports
          : settings.imports;

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
    cron.schedule("0,30 19-00 * * *", async () => {
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

    // Fonction pour planifier les CRON post-match avec nettoyage automatique
    const scheduledCrons = new Map<string, { task: any; scheduledAt: number }>();

    // Fonction de nettoyage des anciens CRON
    function cleanupOldCrons() {
      const now = Date.now();
      const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000); // 7 jours
      let cleanedCount = 0;

      for (const [cronKey, cronData] of scheduledCrons.entries()) {
        if (cronData.scheduledAt < oneWeekAgo) {
          try {
            cronData.task.destroy();
          } catch (e) {
            console.warn("⚠️ Erreur lors de la suppression du CRON:", e);
          }
          scheduledCrons.delete(cronKey);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 Nettoyage: ${cleanedCount} anciens CRON supprimés`);
      }
    }

    async function scheduleMatchesPostUpdate() {
      if (!(await isAutoImportEnabled())) {
        console.log("⏸️ Auto-import désactivé → skip planification post-match");
        return;
      }

      console.log(
        "🔍 Recherche des matchs pour planifier les CRON post-match..."
      );

      // Nettoyer d'abord les anciens CRON
      cleanupOldCrons();

      // Filtrer les matchs futurs seulement (optimisation)
      const now = new Date();
      const oneMonthFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

      const matches = await strapi.entityService.findMany("api::match.match", {
        filters: {
          date: { 
            $notNull: true,
            $gte: now.toISOString().split('T')[0], // Aujourd'hui ou plus tard
            $lte: oneMonthFromNow.toISOString().split('T')[0] // Dans les 30 jours max
          },
          time: { $notNull: true },
        },
        sort: ["date:asc", "time:asc"],
        limit: 100, // Limité à 100 matchs futurs
      });

      console.log(`🔍 ${matches.length} matchs futurs trouvés pour planification.`);

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
          return; // Déjà programmé
        }

        console.log(
          `🕑 Programmation CRON post-match pour le ${postMatchDate.toString()} → ${cronExpression}`
        );

        const task = cron.schedule(cronExpression, async () => {
          if (!(await isAutoImportEnabled())) {
            console.log("⏸️ Auto-import désactivé → skip import post-match");
            // Auto-nettoyage: supprimer cette tâche du registre
            scheduledCrons.delete(cronKey);
            try { task.destroy(); } catch {}
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

          // Auto-nettoyage après exécution (one-time job)
          console.log(`🧹 Nettoyage CRON post-match pour: ${match.home_team} vs ${match.away_team}`);
          scheduledCrons.delete(cronKey);
          try { task.destroy(); } catch {}
        });

        scheduledCrons.set(cronKey, { 
          task, 
          scheduledAt: Date.now() 
        });
      });

      console.log(`📊 Total CRON actifs: ${scheduledCrons.size}`);
    }

    // Planification initiale au démarrage
    scheduleMatchesPostUpdate();

    // Refresh des CRON post-match toutes les 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      console.log("🔄 Refresh des CRON post-match (toutes les 5 min)");
      await scheduleMatchesPostUpdate();
    });
  },
};
