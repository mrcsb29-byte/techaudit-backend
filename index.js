const express = require("express");

const app = express();

// Middleware de sécurité : vérifie un header secret
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

// Endpoint principal : /pagespeed-audit
app.get("/pagespeed-audit", async (req, res) => {
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
      firstContentfulPaint:
        audits["first-contentful-paint"]?.displayValue ?? null,
      largestContentfulPaint:
        audits["largest-contentful-paint"]?.displayValue ?? null,
      totalBlockingTime:
        audits["total-blocking-time"]?.displayValue ?? null,
      cumulativeLayoutShift:
        audits["cumulative-layout-shift"]?.displayValue ?? null
    };

    const result = {
      url,
      strategy,
      performanceScore: perfScore,
      coreWebVitals
    };

    return res.json(result);
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "Internal error while calling PageSpeed API" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("TechAudit backend running on port " + PORT);
});
