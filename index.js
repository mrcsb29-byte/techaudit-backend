const express = require("express");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(express.json());

// Middleware secret
app.use((req, res, next) => {
  const expected = process.env.TECHAUDIT_SECRET;
  const incoming = req.headers["x-techaudit-secret"];

  if (req.path === "/" || req.path.startsWith("/public")) {
    return next();
  }

  if (!expected) {
    return res.status(500).json({ error: "Server missing TECHAUDIT_SECRET" });
  }

  if (!incoming || incoming !== expected) {
    return res.status(403).json({ error: "Forbidden: invalid secret" });
  }

  next();
});

// Servir le frontend
app.use(express.static(path.join(__dirname, "public")));

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

    const performance = data.lighthouseResult?.categories?.performance?.score || 0;
    const seo = data.lighthouseResult?.categories?.seo?.score || 0;

    const audits = data.lighthouseResult?.audits || {};
    const core = {
      firstContentfulPaint: audits["first-contentful-paint"]?.displayValue || null,
      largestContentfulPaint: audits["largest-contentful-paint"]?.displayValue || null,
      totalBlockingTime: audits["total-blocking-time"]?.displayValue || null,
      cumulativeLayoutShift: audits["cumulative-layout-shift"]?.displayValue || null
    };

    res.json({
      url,
      strategy,
      performance,
      coreWebVitals: core,
      seo,
      raw: data
    });

  } catch (err) {
    res.status(500).json({ error: "Audit failed", details: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🚀 TechAudit backend running on port " + PORT);
});
