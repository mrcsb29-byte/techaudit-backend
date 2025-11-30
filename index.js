const express = require("express");
const fetch = require("node-fetch"); // maintenant disponible
const path = require("path");

const app = express();
app.use(express.json());

// middleware secret
app.use((req, res, next) => {
  const expected = process.env.TECHAUDIT_SECRET;
  const incoming = req.headers["x-techaudit-secret"];

  if (req.path === "/" || req.path.startsWith("/public")) return next();

  if (!expected) return res.status(500).json({ error: "Server missing TECHAUDIT_SECRET" });
  if (!incoming || incoming !== expected) return res.status(403).json({ error: "Forbidden" });

  next();
});

// servir les fichiers du dossier public
app.use(express.static(path.join(__dirname, "public")));

app.get("/audit", async (req, res) => {
  try {
    const url = req.query.url;
    const strategy = req.query.strategy || "mobile";

    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}`;

    const response = await fetch(api);
    const data = await response.json();

    const lighthouse = data.lighthouseResult;

    res.json({
      performance: lighthouse?.categories?.performance?.score || 0,
      seo: lighthouse?.categories?.seo?.score || 0,
      coreWebVitals: lighthouse?.audits || {}
    });

  } catch (err) {
    res.status(500).json({ error: "Audit failed", detail: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
