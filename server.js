require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const applicationsRouter = require("./routes/applications");
const { supabase } = require("./supabase");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null
  }
}}));
const allowedOrigin = process.env.CORS_ORIGIN;
app.use(cors({ origin: allowedOrigin ? allowedOrigin.split(",").map(s => s.trim()) : false }));
app.use(express.json({ limit: "30kb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }));
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("/api/health", (req, res) => res.json({
  status: "ok",
  service: "job-application-tracker",
  databaseConfigured: Boolean(supabase),
  timestamp: new Date().toISOString()
}));
app.use("/api/applications", applicationsRouter);
app.use("/api", (req, res) => res.status(404).json({ error: "API endpoint not found." }));
app.get("*splat", (req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "index.html")));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ error: "Invalid JSON request body." });
  console.error("Unhandled server error:", err.message);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(PORT, () => {
  console.log(`JobTrack is running at http://localhost:${PORT}`);
  console.log(`Database configured: ${Boolean(supabase)}`);
});
