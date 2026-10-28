# LLM API Playground

A full-stack web app for experimenting with Large Language Model (LLM) APIs. You write a prompt, adjust the **system prompt** and **temperature**, and choose whether the answer **streams** in token by token or arrives **all at once**. The response is rendered as Markdown, with headings, lists, tables and code blocks.

The backend calls the `openai/gpt-oss-120b` model hosted on **[Groq](https://groq.com)** through the **[Vercel AI SDK](https://ai-sdk.dev)**. It is protected with **CORS**, **rate limiting**, security headers and input validation.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [How it works](#how-it-works)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Security](#security)
- [Frontend UI](#frontend-ui)
- [Key concepts explained](#key-concepts-explained)
- [Troubleshooting](#troubleshooting)
- [Ideas for future improvements](#ideas-for-future-improvements)

---

## Features

| Feature | Description |
| --- | --- |
| Two generation modes | **Stream**: text appears as it is generated. **Generate**: the full answer appears when it is finished. |
| System prompt editor | Controls the AI's role, tone and formatting. Can be reset to the default. |
| Temperature control | A slider from `0.0` (predictable) to `1.5` (creative). |
| Markdown rendering | Supports GitHub Flavored Markdown: tables, code blocks, lists and links. |
| Stop generation | Cancels a stream partway through. The backend also stops calling the model. |
| Example prompts | One-click starter prompts. |
| Response stats | Word count, character count and time taken. |
| Backend status | The header shows whether the API is reachable. |
| Keyboard shortcut | `Ctrl + Enter` (or `Cmd + Enter`) sends the prompt. |
| Rate limit feedback | When the API returns `429`, the button shows a countdown until you can retry. |
| Responsive layout | Two columns on desktop, stacked on mobile. |
| Security | CORS allowlist, two-tier rate limiting, Helmet headers, body size limit, input validation. |

---

## Tech stack

### Frontend — `llm-api-playground-frontend/`

| Tool | Purpose |
| --- | --- |
| [React 19](https://react.dev) | UI library |
| [Vite](https://vite.dev) | Dev server and build tool |
| [Tailwind CSS v4](https://tailwindcss.com) | Utility-first styling |
| [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) | Render the AI's Markdown output |
| [Oxlint](https://oxc.rs) | Linter |

### Backend — `llm-api-playground-backend/`

| Tool | Purpose |
| --- | --- |
| [Node.js](https://nodejs.org) + [Express 5](https://expressjs.com) | HTTP server |
| [Vercel AI SDK](https://ai-sdk.dev) (`ai`) | `streamText()` and `generateText()` helpers |
| [`@ai-sdk/groq`](https://ai-sdk.dev/providers/ai-sdk-providers/groq) | Groq model provider |
| [`cors`](https://github.com/expressjs/cors) | Cross-Origin Resource Sharing |
| [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit) | Per-IP rate limiting |
| [`helmet`](https://helmetjs.github.io) | Secure HTTP headers |
| [`dotenv`](https://github.com/motdotla/dotenv) | Load `.env` configuration |
| [`nodemon`](https://nodemon.io) | Auto-restart during development |

---

## Project structure

```
llm-api-playground/
├── README.md                          ← you are here
│
├── llm-api-playground-backend/
│   ├── .env                           ← your secrets (git-ignored, never commit)
│   ├── .env.example                   ← template for .env
│   ├── package.json
│   └── src/
│       ├── server.js                  ← Express app: middleware, routes, error handling
│       ├── config/
│       │   ├── groq.js                ← Groq provider (reads GROQ_API_KEY)
│       │   └── security.js            ← CORS options, rate limiters, input limits
│       └── routes/
│           └── playground.js          ← POST /stream and POST /generate
│
└── llm-api-playground-frontend/
    ├── .env.example                   ← VITE_API_URL template
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx                   ← React entry point
        ├── App.jsx                    ← page layout, form, request logic
        ├── config.js                  ← API URL, limits, default system prompt, examples
        ├── index.css                  ← Tailwind import + Markdown styles
        └── components/
            ├── Header.jsx             ← top bar with model name and backend status
            └── ResponsePanel.jsx      ← response card: Markdown, copy, clear, stats
```

---

## How it works

```
┌─────────────────────┐   POST /api/playground/stream    ┌─────────────────────────┐            ┌──────────┐
│   React frontend    │   or  /api/playground/generate   │     Express backend     │            │          │
│  (localhost:5173)   │ ───────────────────────────────▶ │     (localhost:5000)    │ ─────────▶ │   Groq   │
│                     │  { prompt, systemPrompt,         │                         │  AI SDK    │   API    │
│  - prompt form      │    temperature }                 │  1. Helmet headers      │            │          │
│  - mode toggle      │                                  │  2. CORS check          │ ◀───────── │          │
│  - Markdown output  │ ◀─────────────────────────────── │  3. JSON body (≤ 50kb)  │  tokens    └──────────┘
│                     │  text stream  OR  { text }       │  4. Rate limiters       │
└─────────────────────┘                                  │  5. Input validation    │
                                                         │  6. streamText /        │
                                                         │     generateText        │
                                                         └─────────────────────────┘
```

### Request lifecycle

1. **The user submits** a prompt. `App.jsx` sends `POST` to `/api/playground/stream` or `/api/playground/generate` with a JSON body.
2. **Helmet** adds security headers to the response.
3. **CORS** checks the request's `Origin` header against the allowlist (`CORS_ORIGINS`). If the origin is not on the list, the browser blocks the response.
4. **`express.json()`** parses the body and rejects anything over 50 KB with `413`.
5. **The rate limiters** count the request against the caller's IP:
   - `apiLimiter`: 100 requests per 15 minutes on every `/api/*` route.
   - `generationLimiter`: 10 requests per minute on `/api/playground/*`.

   Over either limit, the API returns `429 Too Many Requests` with a `Retry-After` header.
6. **Validation** checks the `prompt`, `systemPrompt` and `temperature` (type, length and range). Invalid input gets `400`.
7. **The AI SDK** calls Groq:
   - `/stream` uses `streamText()` and writes each chunk to the response with `res.write()`. The frontend reads the body with a `ReadableStream` reader and appends each chunk to the screen.
   - `/generate` uses `generateText()`, waits for the full answer, and returns `{ success: true, text }`.
8. **If the client disconnects** (for example, the user clicks **Stop**), the backend aborts the Groq request through an `AbortController`, so no more tokens are generated or billed.

---

## Getting started

### Prerequisites

- **Node.js 20+** (developed on Node 24)
- A free **Groq API key** from <https://console.groq.com/keys>

### 1. Backend

```bash
cd llm-api-playground-backend
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
# open .env and set GROQ_API_KEY=...
npm run dev                 # starts on http://localhost:5000 with auto-reload
```

Check that it is running:

```bash
curl http://localhost:5000/api/health
# {"success":true,"message":"Backend is healthy","timestamp":"..."}
```

### 2. Frontend

In a second terminal:

```bash
cd llm-api-playground-frontend
npm install
npm run dev                 # starts on http://localhost:5173
```

Open <http://localhost:5173>. The header should show a green **Backend online** badge.

> Optional: to point the frontend at a different backend, copy `.env.example` to `.env` and set `VITE_API_URL`.

### Available scripts

| Location | Command | What it does |
| --- | --- | --- |
| backend | `npm run dev` | Start with nodemon (auto-restart on file changes) |
| backend | `npm start` | Start with plain Node (production) |
| frontend | `npm run dev` | Vite dev server with hot reload |
| frontend | `npm run build` | Production build to `dist/` |
| frontend | `npm run preview` | Serve the production build locally |
| frontend | `npm run lint` | Run Oxlint |

---

## Environment variables

### Backend (`llm-api-playground-backend/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `5000` | Port the server listens on |
| `GROQ_API_KEY` | — (**required**) | Your Groq API key |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Groq model ID to use |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed frontend origins |
| `API_RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Window for the general API limit |
| `API_RATE_LIMIT_MAX` | `100` | Maximum requests per IP per window, all `/api` routes |
| `LLM_RATE_LIMIT_WINDOW_MS` | `60000` (1 min) | Window for the generation limit |
| `LLM_RATE_LIMIT_MAX` | `10` | Maximum generation requests per IP per window |
| `MAX_PROMPT_LENGTH` | `8000` | Maximum characters in `prompt` |
| `MAX_SYSTEM_PROMPT_LENGTH` | `4000` | Maximum characters in `systemPrompt` |
| `TRUST_PROXY` | unset | Set to `1` when behind a reverse proxy (see [Security](#security)) |

### Frontend (`llm-api-playground-frontend/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:5000` | Base URL of the backend, without a trailing slash |

> **Never commit `.env`.** The backend's `.gitignore` excludes it. `VITE_*` variables are built into the frontend bundle and anyone can read them, so never put secrets in them.

---

## API reference

Base URL: `http://localhost:5000`

All error responses use the same shape:

```json
{ "success": false, "message": "Human-readable reason" }
```

### `GET /api/health`

Health check. **Not rate limited**, so uptime monitors can call it freely.

```json
{ "success": true, "message": "Backend is healthy", "timestamp": "2026-10-27T05:43:33.494Z" }
```

### `POST /api/playground/stream`

Streams the answer as plain text (`Content-Type: text/plain`) while it is being generated.

**Request body**

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `prompt` | string | yes | Non-empty, ≤ `MAX_PROMPT_LENGTH` characters |
| `systemPrompt` | string | no | ≤ `MAX_SYSTEM_PROMPT_LENGTH` characters. Default: `"You are a helpful AI assistant."` |
| `temperature` | number | no | `0`–`2`. Default: `0.7` |

```bash
curl -N http://localhost:5000/api/playground/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Explain closures in JavaScript","temperature":0.5}'
```

### `POST /api/playground/generate`

Same request body. Returns JSON once the answer is complete:

```json
{ "success": true, "text": "## Closures\n\nA closure is ..." }
```

### Status codes

| Code | Meaning |
| --- | --- |
| `200` | Success |
| `400` | Invalid input or malformed JSON |
| `404` | Unknown route |
| `413` | Request body larger than 50 KB |
| `429` | Rate limit exceeded. Read the `Retry-After` header (seconds). |
| `500` | The model call failed (bad API key, Groq outage, etc.) |

### Rate limit headers

Every `/api/*` response includes [IETF draft-8](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) headers:

```
RateLimit-Policy: "10-in-1min"; q=10; w=60
RateLimit: "10-in-1min"; r=7; t=42      ← r = requests remaining, t = seconds until reset
Retry-After: 42                         ← only on 429 responses
```

---

## Security

### 1. CORS (Cross-Origin Resource Sharing)

**What it is:** Browsers block a web page on one origin (for example `http://evil.com`) from reading responses from another origin (your API), unless the API explicitly allows it through `Access-Control-Allow-Origin` headers.

**Before:** `app.use(cors())` allowed **every** website to call the API from a visitor's browser. Any site could have used your Groq quota.

**Now** (`src/config/security.js`):

- Only origins listed in `CORS_ORIGINS` receive CORS headers. Responses to all other browser origins are blocked by the browser.
- Only the `GET`, `POST` and `OPTIONS` methods and the `Content-Type` header are allowed.
- The `RateLimit` and `Retry-After` headers are exposed so the frontend can read them.
- Preflight responses are cached for 10 minutes (`maxAge: 600`).
- Requests with **no** `Origin` header (curl, Postman, server-to-server calls) are allowed, because CORS is a browser feature only.

> CORS is **not authentication**. It stops other websites from using your API through visitors' browsers, but it does not stop someone calling the API directly with curl. That is what rate limiting is for, and real authentication if you deploy this publicly.

Example production setting:

```env
CORS_ORIGINS=https://playground.example.com,http://localhost:5173
```

### 2. Rate limiting

**What it is:** A cap on how many requests a single client (identified by IP) can make in a time window. This protects against abuse, runaway scripts, brute force and, here in particular, **unexpected LLM bills**.

The project uses two tiers:

| Limiter | Applies to | Default | Why |
| --- | --- | --- | --- |
| `apiLimiter` | all `/api/*` routes except `/api/health` | 100 per 15 min | General abuse protection |
| `generationLimiter` | `/api/playground/*` | 10 per 1 min | Each call costs tokens, so it gets a tighter limit |

When a limit is hit, the API responds with:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{ "success": false, "message": "Generation rate limit reached. Please wait a moment before sending another prompt.", "retryAfterSeconds": 60 }
```

The frontend reads `Retry-After` and disables the submit button with a live countdown.

**Behind a proxy:** On hosts like Render, Railway, Heroku or behind Nginx, every request appears to come from the proxy's IP, so all users would share one limit. Set `TRUST_PROXY=1` so Express reads the real client IP from `X-Forwarded-For`.

**Scaling note:** Counters are stored **in memory**. That is fine for one server instance. With several instances, use a shared store such as [`rate-limit-redis`](https://github.com/express-rate-limit/rate-limit-redis).

### 3. Other protections

| Protection | Where | What it does |
| --- | --- | --- |
| **Helmet** | `server.js` | Sets headers such as `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Strict-Transport-Security` and a Content Security Policy |
| `x-powered-by` disabled | `server.js` | Hides that the server runs Express |
| Body size limit (50 KB) | `server.js` | Rejects oversized payloads with `413` |
| Input validation | `routes/playground.js` | Checks the type, length and range of `prompt`, `systemPrompt` and `temperature` |
| JSON error handler | `server.js` | Returns clean `400`/`413`/`500` JSON without leaking stack traces |
| Abort on disconnect | `routes/playground.js` | Stops the Groq stream when the client goes away |
| `.env` git-ignored | `.gitignore` | Keeps the API key out of version control |
| Safe links | `ResponsePanel.jsx` | Links in AI output open with `rel="noopener noreferrer"` |
| No raw HTML | `react-markdown` | Model output is rendered without `dangerouslySetInnerHTML`, which prevents XSS |

---

## Frontend UI

```
┌──────────────────────────────────────────────────────────────────────────┐
│ { }  LLM API Playground                  openai/gpt-oss-120b  ● Online   │
├────────────────────────────┬─────────────────────────────────────────────┤
│ Your prompt       0/8,000  │ AI Response                  [Clear][Copy]  │
│ ┌────────────────────────┐ │ 312 words · 1,904 characters · 3.2 s        │
│ │                        │ ├─────────────────────────────────────────────┤
│ └────────────────────────┘ │                                             │
│ (example) (example) ...    │  ## Rendered Markdown                       │
├────────────────────────────┤                                             │
│ Generation mode            │  - lists, **bold**, `code`                  │
│ [ Stream | Generate ]      │  | tables | ... |                           │
│ Temperature  ──●──── 0.7   │  ```code blocks```                          │
│ ▸ System prompt  485/4,000 │                                             │
├────────────────────────────┤                                             │
│ [ Start streaming  Ctrl+⏎ ]│                                             │
└────────────────────────────┴─────────────────────────────────────────────┘
```

- **Left column:** the prompt, example chips, mode toggle, temperature slider and a collapsible system prompt editor. Character counters turn red over the limit, and submit is disabled.
- **Right column:** a sticky response panel that auto-scrolls while streaming, with a blinking cursor, skeleton loader, and copy/clear buttons.
- **While generating,** the submit button becomes **Stop generating**.
- **Errors** appear in a red alert. Network failures say whether the backend is down or blocked by CORS.

---

## Key concepts explained

### System prompt vs user prompt

- **System prompt:** instructions about *how* the AI should behave: its role, tone, format and rules. It stays the same across questions.
- **User prompt:** *what* you are asking right now.

### Temperature

Controls randomness when the model picks the next token.

| Value | Behaviour | Good for |
| --- | --- | --- |
| `0.0 – 0.3` | Focused, near-deterministic | Code, facts, extraction |
| `0.4 – 0.8` | Balanced | General Q&A, explanations |
| `0.9 – 1.5` | Creative, more varied | Brainstorming, stories |

### Streaming vs non-streaming

| | `streamText()` → `/stream` | `generateText()` → `/generate` |
| --- | --- | --- |
| Time to first text | Very fast (first token) | Waits for the whole answer |
| Response format | Chunked `text/plain` | A single JSON object |
| Can stop early | Yes | No |
| Best for | Chat UIs, long answers | Background jobs, post-processing the full text |

Under the hood, the stream endpoint keeps the HTTP connection open and calls `res.write(chunk)` for each piece of text. The browser reads it with:

```js
const reader = res.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  setResponse((prev) => prev + decoder.decode(value, { stream: true }));
}
```

### Vercel AI SDK

A provider-agnostic library. Moving from Groq to OpenAI, Anthropic or Google means changing only the provider import in `config/groq.js` and the model ID; `streamText` and `generateText` work the same way.

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Header shows **Backend offline** | The backend isn't running, or `VITE_API_URL` is wrong. Run `npm run dev` in the backend folder. |
| "Could not reach the backend… CORS" | The frontend origin isn't in `CORS_ORIGINS`. For example, Vite picked port `5174` because `5173` was busy. Add that origin to `.env` and restart. |
| `500 Failed to generate…` | Invalid or missing `GROQ_API_KEY`, or a Groq outage. Check the backend console. |
| `429 Too Many Requests` | You hit the rate limit. Wait for the countdown, or raise `LLM_RATE_LIMIT_MAX` for local development. |
| Everyone shares one rate limit after deploying | Set `TRUST_PROXY=1`. |
| `413 Request body is too large` | The prompt is over 50 KB. Shorten it. |

---

## Ideas for future improvements

- Model picker (choose among several Groq models)
- Conversation history with multi-turn chat (`messages` instead of `prompt`)
- Token usage and cost display (the AI SDK returns `usage`)
- Syntax highlighting for code blocks
- Dark mode
- API key authentication or user login before public deployment
- Redis-backed rate limit store for multi-instance deployments
- Automated tests (Vitest + Supertest)
