import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents = {
  table: ({ children }) => (
    <div className="table-wrapper">
      <table>{children}</table>
    </div>
  ),
  pre: ({ children }) => <pre className="code-block">{children}</pre>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

function formatDuration(ms) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export default function ResponsePanel({
  response,
  loading,
  mode,
  stats,
  onClear,
}) {
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef(null);

  // Keep the newest streamed text in view.
  useEffect(() => {
    if (loading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [response, loading]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const words = response.trim() ? response.trim().split(/\s+/).length : 0;

  return (
    <section className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-20 lg:h-[calc(100vh-6.5rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            AI Response
            {loading && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {mode === "stream" ? "Streaming" : "Generating"}
              </span>
            )}
          </h2>

          <p className="mt-0.5 text-xs text-slate-500">
            {response
              ? `${words} words · ${response.length} characters${
                  stats?.durationMs != null
                    ? ` · ${formatDuration(stats.durationMs)}`
                    : ""
                }${stats?.stopped ? " · stopped" : ""}`
              : mode === "stream"
                ? "Streaming generation"
                : "Complete generation"}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClear}
            disabled={!response || loading}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!response}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="markdown-content flex-1 overflow-y-auto">
        {loading && !response ? (
          <div className="space-y-3" aria-live="polite">
            <p className="text-sm text-slate-500">
              {mode === "stream"
                ? "Waiting for the first token..."
                : "Generating your answer..."}
            </p>
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
          </div>
        ) : response ? (
          <>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {response}
            </ReactMarkdown>
            {loading && <span className="streaming-cursor" />}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-xl text-indigo-600">
              ✦
            </div>
            <p className="font-medium text-slate-700">
              Your AI response will appear here
            </p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">
              Write a prompt, pick a generation mode and press{" "}
              <kbd className="kbd">Ctrl</kbd> + <kbd className="kbd">Enter</kbd>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
