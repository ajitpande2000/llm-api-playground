import { MODEL_NAME } from "../config";

const STATUS_STYLES = {
  checking: { dot: "bg-amber-400", label: "Checking backend..." },
  online: { dot: "bg-emerald-500", label: "Backend online" },
  offline: { dot: "bg-red-500", label: "Backend offline" },
};

export default function Header({ status }) {
  const { dot, label } = STATUS_STYLES[status];

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 font-mono text-sm font-bold text-white">
            {"{ }"}
          </div>

          <div>
            <h1 className="text-base font-bold leading-tight sm:text-lg">
              LLM API Playground
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block">
              Experiment with prompts, system instructions and temperature
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-slate-600 md:inline">
            {MODEL_NAME}
          </span>

          <span
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600"
            title={label}
          >
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            <span className="hidden sm:inline">{label}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
