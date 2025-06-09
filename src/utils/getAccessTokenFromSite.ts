import puppeteer from "puppeteer";

export async function getPublicAccessToken(): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ["--no-sandbox"],
  });

  const page = await browser.newPage();

  let wpToken: string | null = null;

  // Intercepte toutes les requêtes réseau
  page.on("request", (req) => {
    const authHeader = req.headers()["authorization"];
    if (authHeader && authHeader.startsWith("WP_Access")) {
      wpToken = authHeader.replace("WP_Access ", "");
    }
  });

  await page.goto(
    "https://www.lffs.eu/competitions-bruxelles-brabant-wallon/?season_id=8&organization_id=1&serie_id=1040",
    {
      waitUntil: "networkidle0",
    }
  );

  // Attendre un peu au cas où
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await browser.close();

  if (!wpToken) {
    throw new Error(
      "❌ Impossible de récupérer le token WP_Access depuis les headers"
    );
  }

  return wpToken;
}
