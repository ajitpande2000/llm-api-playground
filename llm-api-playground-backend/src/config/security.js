import { rateLimit } from "express-rate-limit";

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

// Comma-separated list, e.g. "http://localhost:5173,https://my-app.com"
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const corsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header (curl, Postman, server-to-server)
    // are not subject to CORS. Browsers always send Origin on cross-site calls.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Omit CORS headers so the browser blocks the response.
    return callback(null, false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  // Let the frontend read rate limit info from the response.
  exposedHeaders: ["RateLimit", "RateLimit-Policy", "Retry-After"],
  maxAge: 600,
};

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const rateLimitHandler = (message) => (req, res, next, options) => {
  res.status(options.statusCode).json({
    success: false,
    message,
    retryAfterSeconds: Math.ceil(options.windowMs / 1000),
  });
};

// General limit for every /api route.
export const apiLimiter = rateLimit({
  windowMs: toNumber(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  limit: toNumber(process.env.API_RATE_LIMIT_MAX, 100),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitHandler(
    "Too many requests from this IP. Please try again later."
  ),
});

// Stricter limit for the endpoints that call the LLM (they cost money).
export const generationLimiter = rateLimit({
  windowMs: toNumber(process.env.LLM_RATE_LIMIT_WINDOW_MS, 60 * 1000),
  limit: toNumber(process.env.LLM_RATE_LIMIT_MAX, 10),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitHandler(
    "Generation rate limit reached. Please wait a moment before sending another prompt."
  ),
});

// ---------------------------------------------------------------------------
// Input limits
// ---------------------------------------------------------------------------

export const inputLimits = {
  maxPromptLength: toNumber(process.env.MAX_PROMPT_LENGTH, 8000),
  maxSystemPromptLength: toNumber(process.env.MAX_SYSTEM_PROMPT_LENGTH, 4000),
  minTemperature: 0,
  maxTemperature: 2,
};
