import { useEffect, useRef, useState } from "react";
import Header from "./components/Header";
import ResponsePanel from "./components/ResponsePanel";
import {
  PLAYGROUND_URL,
  HEALTH_URL,
  MAX_PROMPT_LENGTH,
  MAX_SYSTEM_PROMPT_LENGTH,
  DEFAULT_SYSTEM_PROMPT,
  EXAMPLE_PROMPTS,
} from "./config";

const MODES = [
  {
    value: "stream",
    label: "Stream",
    hint: "The response appears progressively as the AI generates it.",
  },
  {
    value: "generate",
    label: "Generate",
    hint: "The complete response appears after the AI finishes generating.",
  },
];

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

function CharCount({ value, max }) {
  const over = value.length > max;

  return (
    <span
      className={`font-mono text-xs ${over ? "font-semibold text-red-600" : "text-slate-400"}`}
    >
      {value.length.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [temperature, setTemperature] = useState(0.7);
  const [mode, setMode] = useState("stream");

  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [backendStatus, setBackendStatus] = useState("checking");

  const abortRef = useRef(null);

  // Check whether the backend is reachable.
  useEffect(() => {
    fetch(HEALTH_URL)
      .then((res) => setBackendStatus(res.ok ? "online" : "offline"))
      .catch(() => setBackendStatus("offline"));
  }, []);

  // Count down after the API responds with 429 Too Many Requests.
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const promptTooLong = prompt.length > MAX_PROMPT_LENGTH;
  const systemPromptTooLong = systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH;
  const canSubmit =
    !loading &&
    cooldown === 0 &&
    prompt.trim() &&
    !promptTooLong &&
    !systemPromptTooLong;

  async function handleSubmit(event) {
    event?.preventDefault();

    if (!canSubmit) {
      if (!prompt.trim()) setError("Please enter a prompt.");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = performance.now();

    setLoading(true);
    setResponse("");
    setError("");
    setStats(null);

    try {
      const res = await fetch(`${PLAYGROUND_URL}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, systemPrompt, temperature }),
        signal: controller.signal,
      });

      setBackendStatus("online");

      if (!res.ok) {
        let message = "Failed to generate response.";

        try {
          const data = await res.json();
          message = data.message || message;
        } catch {
          // Keep the default error message if the response isn't JSON.
        }

        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("Retry-After")) || 60;
          setCooldown(retryAfter);
        }

        throw new Error(message);
      }

      if (mode === "stream") {
        if (!res.body) {
          throw new Error("Streaming is not supported by this response.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          setResponse((previous) => previous + chunk);
        }

        const remaining = decoder.decode();
        if (remaining) setResponse((previous) => previous + remaining);
      } else {
        const data = await res.json();

        if (data.success === false) {
          throw new Error(data.message || "Failed to generate response.");
        }

        if (typeof data.text !== "string") {
          throw new Error("The API returned an invalid response.");
        }

        setResponse(data.text);
      }

      setStats({ durationMs: Math.round(performance.now() - startedAt) });
    } catch (err) {
      if (err.name === "AbortError") {
        setStats({
          durationMs: Math.round(performance.now() - startedAt),
          stopped: true,
        });
      } else if (err instanceof TypeError) {
        setBackendStatus("offline");
        setError(
          "Could not reach the backend. Make sure it is running and that this origin is allowed by CORS."
        );
      } else {
        setError(err.message || "Something went wrong.");
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      handleSubmit(event);
    }
  }

  const activeMode = MODES.find((m) => m.value === mode);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header status={backendStatus} />

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        {/* Settings and prompt */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          className="space-y-5"
        >
          {/* User prompt */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="prompt" className="text-sm font-semibold">
                Your prompt
              </label>
              <CharCount value={prompt} max={MAX_PROMPT_LENGTH} />
            </div>

            <textarea
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={6}
              className={inputClass}
              placeholder="Ask anything... e.g. Explain React hooks with a practical example."
              autoFocus
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* Generation mode */}
            <div>
              <span className="mb-2 block text-sm font-semibold">
                Generation mode
              </span>

              <div
                role="radiogroup"
                aria-label="Generation mode"
                className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"
              >
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={mode === m.value}
                    disabled={loading}
                    onClick={() => setMode(m.value)}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${
                      mode === m.value
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <p className="mt-2 text-xs text-slate-500">{activeMode.hint}</p>
            </div>

            {/* Temperature */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="temperature" className="text-sm font-semibold">
                  Temperature
                </label>
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-sm text-indigo-700">
                  {temperature.toFixed(1)}
                </span>
              </div>

              <input
                id="temperature"
                type="range"
                min="0"
                max="1.5"
                step="0.1"
                value={temperature}
                onChange={(event) => setTemperature(Number(event.target.value))}
                className="w-full accent-indigo-600"
              />

              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>Precise</span>
                <span>Balanced</span>
                <span>Creative</span>
              </div>
            </div>

            {/* System prompt */}
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <span className="inline-block text-slate-400 transition group-open:rotate-90">
                    ▸
                  </span>
                  System prompt
                </span>
                <CharCount value={systemPrompt} max={MAX_SYSTEM_PROMPT_LENGTH} />
              </summary>

              <textarea
                id="systemPrompt"
                aria-label="System prompt"
                value={systemPrompt}
                onChange={(event) => setSystemPrompt(event.target.value)}
                rows={9}
                className={`${inputClass} mt-3 font-mono text-xs leading-relaxed`}
                placeholder="Tell the AI how to respond..."
              />

              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Defines the AI's behavior, tone and formatting.
                </p>
                <button
                  type="button"
                  onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                  disabled={systemPrompt === DEFAULT_SYSTEM_PROMPT}
                  className="shrink-0 text-xs font-medium text-indigo-600 hover:underline disabled:cursor-default disabled:text-slate-300 disabled:no-underline"
                >
                  Reset
                </button>
              </div>
            </details>
          </div>

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <p className="font-semibold">Something went wrong</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {/* Submit / stop */}
          {loading ? (
            <button
              type="button"
              onClick={handleStop}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <span className="h-3 w-3 rounded-sm bg-slate-700" />
              Stop generating
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cooldown > 0 ? (
                `Rate limited — try again in ${cooldown}s`
              ) : (
                <>
                  {mode === "stream" ? "Start streaming" : "Generate response"}
                  <span className="hidden text-xs font-normal opacity-75 sm:inline">
                    Ctrl + Enter
                  </span>
                </>
              )}
            </button>
          )}
        </form>

        {/* Response */}
        <ResponsePanel
          response={response}
          loading={loading}
          mode={mode}
          stats={stats}
          onClear={() => {
            setResponse("");
            setStats(null);
          }}
        />
      </main>

      <footer className="pb-6 text-center text-xs text-slate-400">
        Powered by Vercel AI SDK and Groq
      </footer>
    </div>
  );
}
