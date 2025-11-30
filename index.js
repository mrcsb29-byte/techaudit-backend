// index.js
const express = require("express");
const path = require("path");

const app = express();

/**
 * 1) Servir le dashboard (public/index.html)
 *    Accessible sans secret.
 */
app.use(express.static(path.join(__dirname, "public")));

/**
 * 2) Middleware de sécurité pour les endpoints API
 *    (santé + audit).
 */
function requireSecret(req, res, next) {
  const secret = req.headers["x-techaudit-secret"];
  const expected = process.env.TECHAUDIT_SECRET;

  if (!expected) {
    console.error("TECHAUDIT_SECRET non défini dans les variables d'environnement");
    return res
      .status(500)
      .json({ error: "Server misconfigured: missing TECHAUDIT_SECRET" });
  }

  if (secret !== expected) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

/**
 * 3) Endpoint /health
 *    Pour vérifier que le backend est joignable et que le secret est bon.
 */
app.get("/health", requireSecret, (req, res) => {
  res.json({ status: "ok" });
});

/**
 * 4) Endpoint unique : /pagespeed-audit
 *    Renvoie :
 *      - performanceScore
 *      - coreWebVitals
 *      - seoScore
 *      - screenshot (base64 data URL)
 *      - rawLighthouse (brut pour debug)
 *
 *    Exemple d'appel :
 *    GET /pagespeed-audit?url=https://www.exorciste-guerisseur.fr/&strategy=mobile
 *    Header : x-techaudit-secret: TON_SECRET
 */
app.get("/pagespeed-audit", requireSecret, async (req, res) => {
  try {
    const url = req.query.url;
    const strategy = req.query.strategy || "mobile";

    if (!url) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    const apiKey = process.env.PAGESPEED_API_KEY;
    if (!apiKey) {
      console.error("PAGESPEED_API_KEY non défini dans les variables d'environnement");
      return res
        .status(500)
        .json({ error: "Server misconfigured: missing PAGESPEED_API_KEY" });
    }

    // Appel à l’API PageSpeed
    const googleUrl =
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" +
      `?url=${encodeURIComponent(url)}` +
      `&strategy=${strategy}` +
      `&category=performance` +
      `&category=seo` +
      `&screenshot=true` +
      `&key=${apiKey}`;

    const googleRes = await fetch(googleUrl);
    const data = await googleRes.json();

    const lighthouse = data?.lighthouseResult || {};
    const categories = lighthouse.categories || {};
    const audits = lighthouse.audits || {};

    // Score de performance
    const performanceScore = categories.performance?.score ?? null;

    // Core Web Vitals (valeurs lisibles)
    const coreWebVitals = {
      firstContentfulPaint:
        audits["first-contentful-paint"]?.displayValue ?? null,
      largestContentfulPaint:
        audits["largest-contentful-paint"]?.displayValue ?? null,
      totalBlockingTime:
        audits["total-blocking-time"]?.displayValue ?? null,
      cumulativeLayoutShift:
        audits["cumulative-layout-shift"]?.displayValue ?? null,
    };

    // SEO : score global
    const seoScore = categories.seo?.score ?? null;

    // Screenshot final (data:image/jpeg;base64,....)
    const screenshot =
      audits["final-screenshot"]?.details?.data ?? null;

    const result = {
      url,
      strategy,
      performanceScore,
      coreWebVitals,
      seoScore,
      screenshot,
      rawLighthouse: lighthouse, // utile pour le bloc "Réponse brute (debug)"
    };

    return res.json(result);
  } catch (e) {
    console.error("Erreur dans /pagespeed-audit", e);
    return res
      .status(500)
      .json({ error: "Internal error while calling PageSpeed API" });
  }
});

/**
 * 5) Lancement du serveur
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("TechAudit backend running on port " + PORT);
});
