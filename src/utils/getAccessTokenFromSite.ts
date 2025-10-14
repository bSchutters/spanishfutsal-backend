import puppeteer from "puppeteer";

// Cache mémoire simple du token public
let cachedToken: string | null = null;
let cachedAt = 0;
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 heures (au lieu de 30min)

export async function getPublicAccessToken(options?: {
  forceRefresh?: boolean;
}): Promise<string> {
  const forceRefresh = options?.forceRefresh === true;
  const now = Date.now();
  
  // Utiliser le cache si disponible et valide
  if (!forceRefresh && cachedToken && now - cachedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  // Retry avec backoff exponentiel
  let lastError: Error | null = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Tentative ${attempt}/${maxRetries} - Récupération token LFFS...`);

      const token = await fetchTokenWithPuppeteer();

      // Mise à jour du cache
      cachedToken = token;
      cachedAt = Date.now();

      console.log(`✅ Token récupéré avec succès (tentative ${attempt})`);
      return token;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Échec tentative ${attempt}/${maxRetries}:`, lastError.message);

      // Si ce n'est pas la dernière tentative, attendre avant retry
      if (attempt < maxRetries) {
        // Backoff: 2s, 5s, 10s
        const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
        console.log(`⏳ Attente ${backoffMs / 1000}s avant retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  // Si tous les retries ont échoué
  throw new Error(
    `❌ Impossible de récupérer le token après ${maxRetries} tentatives. Dernière erreur: ${lastError?.message || 'Inconnue'}`
  );
}

async function fetchTokenWithPuppeteer(): Promise<string> {
  let browser: any | null = null;

  try {
    console.log("🌐 Lancement du navigateur Puppeteer...");
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // Évite les problèmes de mémoire
        "--disable-gpu"
      ],
      timeout: 30000, // Timeout de lancement
    });

    const page = await browser.newPage();

    // Optimisations performance
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1280, height: 720 });

    let wpToken: string | null = null;
    let tokenFound = false;
    let requestCount = 0;

    // Intercepte toutes les requêtes réseau
    page.on("request", (req: any) => {
      requestCount++;
      if (tokenFound) return; // Évite les traitements inutiles

      const authHeader = req.headers()["authorization"];
      if (authHeader && authHeader.startsWith("WP_Access")) {
        wpToken = authHeader.replace("WP_Access ", "");
        tokenFound = true;
        console.log(`🎯 Token détecté dans les headers (après ${requestCount} requêtes)`);
      }
    });

    // Navigation avec timeout augmenté et stratégie networkidle2
    console.log("📡 Navigation vers le site LFFS...");
    const navigationPromise = page.goto(
      "https://www.lffs.eu/competitions-bruxelles-brabant-wallon/?season_id=8&organization_id=1&serie_id=1040",
      {
        waitUntil: "networkidle2", // Attend que les requêtes réseau soient terminées
        timeout: 60000, // 60 secondes pour la navigation
      }
    );

    await navigationPromise;
    console.log(`✅ Page chargée (${requestCount} requêtes interceptées)`);

    // Attendre que le token soit trouvé ou timeout
    const tokenWaitPromise = new Promise<void>((resolve) => {
      const checkToken = () => {
        if (tokenFound) {
          resolve();
        } else {
          setTimeout(checkToken, 100);
        }
      };
      checkToken();
    });

    console.log("⏳ Attente de la détection du token...");
    await Promise.race([
      tokenWaitPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: token non trouvé après 30s d\'attente')), 30000)
      )
    ]);

    if (!wpToken) {
      throw new Error("Token WP_Access non détecté dans les requêtes réseau");
    }

    console.log("✅ Token extrait avec succès");
    return wpToken;
    
  } catch (error) {
    throw new Error(
      `Erreur Puppeteer: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    // Nettoyage garanti
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.warn("⚠️ Erreur fermeture browser:", closeError);
      }
    }
  }
}

export function invalidatePublicAccessTokenCache() {
  cachedToken = null;
  cachedAt = 0;
  console.log("🗑️ Cache token invalidé");
}
