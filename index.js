const express = require("express");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(express.json());

// Middleware secret
app.use((req, res, next) => {
  const expected = process.env.TECHAUDIT_SECRET;
  const incoming = req.headers["x-techaudit-secret"];

  // Autoriser l’accès à la page HTML
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

// Servir les fichiers du dossier /public
app.use(express.static(path.join(__dirname, "public")));

// Route racine → sert index.html du bon dossier
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint audit
app.get("/audit", async (req, res) => {
  try {
    const url = req.query.url;
    const strategy = req.query.strategy || "mobile";

    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}`;

    const response = await fetch(api);
    const json = await response.json();

    const lighthouse = json.lighthouseResult;

    res.json({
      performance: lighthouse.categories.performance.score,
      seo: lighthouse.categories.seo.score,
      coreWebVitals: lighthouse.audits,
    });

  } catch (err) {
    console.error("Audit error:", err);
    res.status(500).json({ error: "Audit failed", detail: String(err) });
  }
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
