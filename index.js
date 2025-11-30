const express = require("express");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(express.json());

// Middleware secret (toutes les routes sauf /)
app.use((req, res, next) => {
  const expected = process.env.TECHAUDIT_SECRET;
  const incoming = req.headers["x-techaudit-secret"];

  if (req.path === "/" || req.path.startsWith("/public")) {
    return next();
  }

  if (!expected) {
    console.error("❌ TECHAUDIT_SECRET manquant !");
    return res.status(500).json({ error: "Server missing TECHAUDIT_SECRET" });
  }

  if (!incoming || incoming !== expected) {
    return res.status(403).json({ error: "Forbidden: invalid secret" });
  }

  next();
});

// Servir le frontend
app.use(express.static(path.join(__dirname, "public")));

// Route santé
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * 🔥 ENDPOINT UNIQUE QUI RENVOIE TOUT :
 * /audit?url=...&strategy=mobile|desktop
 *
 * Retour :
 * {
 *   performance,
 *   coreWebVitals,
 *   seo,
 *   screenshot
 * }
 */
app.get("/audit", async (req, res) => {
  try {
    const url = req.query.url;
    const strategy = req.query.strategy || "mobile";

    if (!url) {
      return res.status(400).json({ error: "Missing ?url=" });
    }

    const api =
      "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=" +
      encodeURIComponent(url) +
      "&strategy=" +
      strategy +
      "&screenshot=true";

    const response = await fetch(api);
    const data = await response.json();

    // Score performance
    const performanceScore = data.lighthouseResult?.categories?.performance?.score || 0;

    // SEO score
    const seoScore = data.lighthouseResult?.categories?.seo?.score || 0;

    // Core Web Vitals
    const audits = data.lighthouseResult?.audits || {};
    const core = {
      firstContentfulPaint: audits["first-contentful-paint"]?.displayValue || null,
      largestContentfulPaint: audits["largest-contentful-paint"]?.displayValue || null,
      totalBlockingTime: audits["total-blocking-time"]?.displayValue || null,
      cumulativeLayoutShift: audits["cumulative-layout-shift"]?.displayValue || null,
    };

    // Screenshot final base64
    let screenshot = null;
    try {
      screenshot =
        data.lighthouseResult?.audits["final-screenshot"]?.details?.data || null;
    } catch (e) {
      screenshot = null;
    }

    res.json({
      url,
      strategy,
      performance: performanceScore,
      coreWebVitals: core,
      seo: seoScore,
      screenshot,
      raw: data, // pour debug dans ton interface
    });
  } catch (err) {
    console.error("🔥 ERREUR AUDIT :", err);
    res.status(500).json({ error: "Audit failed", details: err.message });
  }
});

// Démarrage du serveur
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 TechAudit backend running on port " + PORT);
  console.log("Frontend → /");
  console.log("API → /audit");
});
