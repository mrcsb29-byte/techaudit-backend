const express = require("express");

const app = express();

/**
 * 1) Servir l'interface (public/index.html) à la racine "/"
 *    -> https://techaudit-backend-1.onrender.com/
 */
app.use(express.static("public"));

/**
 * 2) Middleware de sécurité pour les routes d'API
 *    On l'appliquera uniquement sur /health et /pagespeed-audit
 */
function checkSecret(req, res, next) {
  const secret = req.headers["x-techaudit-secret"];
  const expected = process.env.TECHAUDIT_SECRET;

  if (!expected) {
    console.error(
      "TECHAUDIT_SECRET non défini dans les variables d'environnement"
    );
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
 * 3) Endpoint /health pour tester facilement depuis Postman/ReqBin
 *    Protégé par le header x-techaudit-secret
 */
app.get("/health", checkSecret, (req, res) => {
  res.json({ status: "ok" });
});

/**
 * 4) Endpoint /pagespeed-audit
 *    ?url=https://ton-site.fr/&strategy=mobile|desktop
 *    Protégé par le header x-techaudit-secret
 */
app.get("/pagespeed-audit", checkSecret, async (req, res) => {
  try {
    const url = req.query.url;
    const strategy = req.query.strategy || "mobile";

    if (!url) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    const apiKey = process.env.PAGESPEED_API_KEY;
    if (!apiKey) {
      console.error(
        "PAGESPEED_API_KEY non défini dans les variables d'environnement"
      );
      return res
        .status(500)
        .json({ error: "Server misconfigured: missing PAGESPEED_API_KEY" });
    }

    const googleUrl =
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" +
      `?url=${encodeURIComponent(url)}` +
      `&strategy=${strategy}` +
      `&key=${apiKey}`;

    // Node 22 sur Render a déjà fetch en global
    const googleRes = await fetch(googleUrl);
    const data = await googleRes.json();

    const perfScore =
      data?.lighthouseResult?.categories?.performance?.score ?? null;

    const audits = data?.lighthouseResult?.audits ?? {};
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

    const result = {
      url,
      strategy,
      performanceScore: perfScore,
      coreWebVitals,
    };

    return res.json(result);
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Internal error while calling PageSpeed API" });
  }
});

// Lancement du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("TechAudit backend running on port " + PORT);
});
