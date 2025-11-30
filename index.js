const express = require("express");
const path = require("path");
const app = express();

/* ------------------------------
   1. SERVIR L’INTERFACE VISUELLE
------------------------------- */

// Sert tous les fichiers du dossier "public" (HTML, CSS, JS…)
app.use(express.static(path.join(__dirname, "public")));

// Quand on visite la racine "/", renvoyer l'interface
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ------------------------------
   2. MIDDLEWARE SÉCURITÉ API
------------------------------- */

app.use((req, res, next) => {
  const secret = req.headers["x-techaudit-secret"];
  const expected = process.env.TECHAUDIT_SECRET;

  // Si pas configuré dans Render
  if (!expected) {
    console.error("❌ TECHAUDIT_SECRET non défini !");
    return res
      .status(500)
      .json({ error: "Server misconfigured: missing TECHAUDIT_SECRET" });
  }

  // Autoriser la racine "/" sans secret → l’interface doit être publique
  if (req.path === "/") {
    return next();
  }

  // Sécurisation des endpoints API
  if (secret !== expected) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
});

/* ------------------------------
   3. ENDPOINT PAGESPEED AUDIT
------------------------------- */

app.get("/pagespeed-audit", async (req, res) => {
  try {
    const url = req.query.url;
    const strategy = req.query.strategy || "mobile";

    if (!url) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    const apiKey = process.env.PAGESPEED_API_KEY;
    if (!apiKey) {
      console.error("❌ PAGESPEED_API_KEY non défini !");
      return res
        .status(500)
        .json({ error: "Server misconfigured: missing PAGESPEED_API_KEY" });
    }

    const googleUrl =
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" +
      `?url=${encodeURIComponent(url)}` +
      `&strategy=${strategy}` +
      `&key=${apiKey}`;

    const googleRes = await fetch(googleUrl);
    const data = await googleRes.json();

    const perfScore =
      data?.lighthouseResult?.categories?.performance?.score ?? null;

    const audits = data?.lighthouseResult?.audits ?? {};
    const coreWebVitals = {
      firstContentfulPaint: audits["first-contentful-paint"]?.displayValue ?? null,
      largestContentfulPaint: audits["largest-contentful-paint"]?.displayValue ?? null,
      totalBlockingTime: audits["total-blocking-time"]?.displayValue ?? null,
      cumulativeLayoutShift: audits["cumulative-layout-shift"]?.displayValue ?? null
    };

    return res.json({
      url,
      strategy,
      performanceScore: perfScore,
      coreWebVitals
    });
  } catch (error) {
    console.error("Erreur PageSpeed :", error);
    return res.status(500).json({
      error: "Internal error while calling PageSpeed API"
    });
  }
});

/* ------------------------------
   4. LANCEMENT DU SERVEUR
------------------------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 TechAudit backend running on port " + PORT);
});
