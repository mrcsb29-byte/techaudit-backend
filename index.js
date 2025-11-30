const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// ➜ Servir les fichiers HTML dans /public
app.use(express.static(path.join(__dirname, "public")));

// ➜ Route principale pour vérifier que le backend tourne
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ➜ Endpoint AUDIT PSI (PageSpeed Insights)
app.get("/audit", async (req, res) => {
  try {
    const url = req.query.url;
    const strategy = req.query.strategy || "mobile";

    if (!url) {
      return res.status(400).json({ error: "Missing ?url parameter" });
    }

    if (!process.env.PSI_API_KEY) {
      return res.status(500).json({ error: "Missing PSI_API_KEY in Render environment" });
    }

    // URL API PageSpeed Insights
    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
      url
    )}&strategy=${strategy}&key=${process.env.PSI_API_KEY}`;

    console.log("Calling PSI API:", api);

    const response = await fetch(api);
    const json = await response.json();

    if (!json.lighthouseResult) {
      return res.status(500).json({
        error: "PSI API returned no lighthouseResult",
        raw: json
      });
    }

    const lighthouse = json.lighthouseResult;

    res.json({
      performance: lighthouse.categories.performance.score,
      seo: lighthouse.categories.seo.score,
      coreWebVitals: {
        firstContentfulPaint: lighthouse.audits["first-contentful-paint"].displayValue,
        largestContentfulPaint: lighthouse.audits["largest-contentful-paint"].displayValue,
        totalBlockingTime: lighthouse.audits["total-blocking-time"].displayValue,
        cumulativeLayoutShift: lighthouse.audits["cumulative-layout-shift"].displayValue
      }
    });

  } catch (err) {
    console.error("Audit error:", err);
    res.status(500).json({
      error: "Audit failed",
      detail: String(err)
    });
  }
});

// ➜ Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
