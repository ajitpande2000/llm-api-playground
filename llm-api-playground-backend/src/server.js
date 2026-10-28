import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import playgroundRouter from "./routes/playground.js";
import {
  corsOptions,
  apiLimiter,
  generationLimiter,
} from "./config/security.js";

const app = express();

// Needed for correct client IPs (and rate limiting) behind a reverse proxy
// such as Nginx, Render, Railway, or Heroku. Set TRUST_PROXY=1 in that case.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
}

app.disable("x-powered-by");
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "50kb" }));

// Root route
app.get("/", (req, res) => {
  res.send("LLM API Playground Backend Running!");
});

// Health check route (not rate limited so uptime monitors keep working)
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend is healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", apiLimiter);
app.use("/api/playground", generationLimiter, playgroundRouter);

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler (malformed JSON, oversized body, unexpected errors)
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Request body must be valid JSON",
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request body is too large",
    });
  }

  console.error("Unhandled error:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
