const express = require("express");
const fetch = require("node-fetch");
const path = require("path");

const app = express();

// Servir le frontend
app.use(express.static(path.join(__dirname, "public")));

app.get("/audit", async (req, res) => {
  try {
    const url = req.query.url;
    const strategy = req.query.strategy || "mobile";

    if (!url) {
      return res.status(400).json({ error: "Missing ?url=" });
    }

    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}`;

    const response = await fetch(api);
    const json = await response.json();

    const lighthouse = json.lighthouseResult;

    res.json({
      performance: lighthouse.categories.performance.score,
      seo: lighthouse.categories.seo.score,
      coreWebVitals: lighthouse.audits,
      raw: json
    });

  } catch (err) {
    console.error("Audit error:", err);
    res.status(500).json({ error: "Audit failed", detail: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
