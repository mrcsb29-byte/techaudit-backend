const express = require("express");
const path = require("path");

const app = express();

// Pour parser du JSON si besoin plus tard
app.use(express.json());

/**
 * 1. SERVE STATIQUE : interface visuelle dans /public
 *    (accessible sans secret, mais toutes les API restent protégées)
 */
app.use(express.static(path.join(__dirname, "public")));

/**
 * 2. HEALTHCHECK NON PROTÉGÉ
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * 3. MIDDLEWARE DE SÉCURITÉ
 *    Toutes les routes API en dessous sont protégées par le header x-techaudit-secret
 */
app.use((req, res, next) => {
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
});

/**
 * 4. FONCTION UTILITAIRE : appel à l'API Google PageSpeed
 */
async function fetchPageSpeed(url, strategy = "mobile") {
  if (!url) {
    throw new Error("Missing url parameter");
  }

  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    console.error("PAGESPEED_API_KEY non défini dans les variables d'environnement");
    throw new Error("Server misconfigured: missing PAGESPEED_API_KEY");
  }

  const googleUrl =
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" +
    `?url=${encodeURIComponent(url)}` +
    `&strategy=${strategy}` +
    `&key=${apiKey}`;

  const googleRes = await fetch(googleUrl);

  if (!googleRes.ok) {
    const text = await googleRes.text();
    console.error("Erreur PageSpeed:", googleRes.status, text);
    throw new Error("PageSpeed API error: " + googleRes.status);
  }

  const data = await googleRes.json();
  return data;
}

/**
 * 5. ENDPOINT RÉSUMÉ GLOBAL (celui que tu avais déjà)
 *    /pagespeed-audit
 */
app.get("/pagespeed-audit", async (req, res) => {
  try {
    const url = req.query.url;
    const strategy = req.query.strategy || "mobile";

    const data = await fetchPageSpeed(url, strategy);

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

/**
 * 6. ENDPOINT CORE WEB VITALS DÉDIÉ
 *    /pagespeed-core-web-vitals
 */
app.get("/pagespeed-core-web-vitals", async (req, res) => {
  try {
    const url = req.query.url;
    const strategy = req.query.strategy || "mobile";

    const data = await fetchPageSpeed(url, strategy);
    const audits = data?.lighthouseResult?.audits ?? {};
    const perfScore =
      data?.lighthouseResult?.categories?.performance?.score ?? null;

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

    res.json({
      url,
      strategy,
      performanceScore: perfScore,
      coreWebVitals,
    });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: "Internal error while calling PageSpeed API" });
  }
});

/**
 * 7. ENDPOINT SEO
 *    /pagespeed-seo
 */
app.get("/pagespeed-seo", async (req, res) => {
  try {
    const url = req.query.url;
    const strategy = req.query.strategy || "mobile";

    const data = await fetchPageSpeed(url, strategy);

    const categories = data?.lighthouseResult?.categories ?? {};
    const audits = data?.lighthouseResult?.audits ?? {};

    const seoScore = categories?.seo?.score ?? null;

    const seoChecks = {
      metaDescription: audits["meta-description"]?.score ?? null,
      viewport: audits["viewport"]?.score ?? null,
      httpStatusCode: audits["http-status-code"]?.score ?? null,
      robotsTxt: audits["robots-txt"]?.score ?? null,
      crawlableAnchors: audits["crawlable-anchors"]?.score ?? null,
      linkText: audits["link-text"]?.score ?? null,
      isCrawlable: audits["is-crawlable"]?.score ?? null,
    };

    res.json({
      url,
      strategy,
      seoScore,
      seoChecks,
    });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: "Internal error while calling PageSpeed API" });
  }
});

/**
 * 8. ENDPOINT SCREENSHOT
 *    /pagespeed-screenshot
 *    Retourne un data:URL (base64) de la capture finale
 */
app.get("/pagespeed-screenshot", async (req, res) => {
  try {
    const url = req.query.url;
    const strategy = req.query.strategy || "mobile";

    const data = await fetchPageSpeed(url, strategy);
    const screenshot =
      data?.lighthouseResult?.audits?.["final-screenshot"]?.details?.data ??
      null;

    res.json({
      url,
      strategy,
      screenshot, // data:image/jpeg;base64,...
    });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: "Internal error while calling PageSpeed API" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("TechAudit backend running on port " + PORT);
});
