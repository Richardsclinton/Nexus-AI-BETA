import type { ExecutionPhase, MonitorEvent, MonitorStatus } from "@/lib/executionModel";

type ExecutionMode = "standard" | "pro";

type ExecutionMonitorProps = {
  phase: ExecutionPhase;
  progress: number;
  events: MonitorEvent[];
  running: boolean;
  executionMode?: ExecutionMode;
};

const PHASES: ExecutionPhase[] = [
  "Interpretation",
  "Planning",
  "Running",
  "Verification",
  "Assembly",
  "Delivered",
];

function colorForStatus(status: MonitorStatus): string {
  if (status === "done") return "text-green-300 border-green-400/40 bg-green-500/10";
  if (status === "running") return "text-light-blue border-light-blue/50 bg-light-blue/10";
  if (status === "failed") return "text-red-300 border-red-500/40 bg-red-500/10";
  return "text-white/70 border-white/20 bg-black/30";
}

function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "+0.0s";
  return `+${(ms / 1000).toFixed(1)}s`;
}

export function ExecutionMonitor({ phase, progress, events, running, executionMode }: ExecutionMonitorProps) {
  const percent = Math.max(0, Math.min(100, progress));
  const originMs = events.length > 0 ? Math.min(...events.map((e) => e.atMs)) : Date.now();
  const nonTerminal = events.filter((e) => e.phase !== "Delivered");
  const uniqueTaskLabels = new Set(nonTerminal.map((e) => e.label));
  const totalTasks = uniqueTaskLabels.size;
  const completedTasks = new Set(
    nonTerminal.filter((e) => e.status === "done").map((e) => e.label)
  ).size;
  const executionClass: ExecutionMode = executionMode === "pro" ? "pro" : "standard";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 backdrop-blur-sm p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-sm md:text-base font-semibold text-white">Execution Monitor</h4>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] md:text-xs uppercase tracking-wider ${running ? "text-light-blue" : "text-white/55"}`}>
            {running ? "live" : "idle"}
          </span>
          {totalTasks > 0 && (
            <span className="text-[10px] md:text-xs text-white/55">
              Tasks {completedTasks}/{totalTasks}
            </span>
          )}
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-2">
          <p className="text-[11px] md:text-xs text-white/60">
            Execution Class:{" "}
            <span
              className={
                executionClass === "pro"
                  ? "font-medium text-neon-pink"
                  : "font-medium text-white/80"
              }
            >
              {executionClass === "pro" ? "Pro (Premium Tier)" : "Standard"}
            </span>
          </p>
          {executionClass === "pro" && (
            <p className="mt-0.5 text-[10px] md:text-[11px] text-neon-pink/70">
              Premium compute allocation enabled.
            </p>
          )}
        </div>
        <p className="text-xs md:text-sm text-white/80 mb-2">
          Current phase: <span className="text-light-blue">{phase}</span>
        </p>
        <div className="h-2 w-full rounded-full bg-black/40 overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-neon-pink via-light-blue to-neon-pink transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-black/25 p-3">
        <p className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider mb-2">Execution Graph</p>
        <div className="flex flex-wrap items-center gap-2 text-[10px] md:text-xs">
          {PHASES.map((p, idx) => {
            const done = PHASES.indexOf(phase) > idx || phase === "Delivered";
            const active = phase === p && running;
            return (
              <div key={p} className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded border transition-colors transition-shadow duration-300 ${
                    active
                      ? `border-light-blue/60 bg-light-blue/10 text-light-blue ${
                          executionClass === "pro"
                            ? "shadow-[0_0_16px_rgba(163,216,244,0.45)] animate-pulse"
                            : "animate-pulse"
                        }`
                      : done
                      ? `border-green-400/40 bg-green-500/10 text-green-300 ${
                          executionClass === "pro" ? "shadow-[0_0_12px_rgba(72,255,163,0.4)]" : ""
                        }`
                      : "border-white/20 bg-black/20 text-white/60"
                  }`}
                >
                  {p}
                </span>
                {idx < PHASES.length - 1 && <span className="text-white/40">-&gt;</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 max-h-52 overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-xs md:text-sm text-white/50">No execution events yet.</p>
        ) : (
          events.map((evt) => (
            <div
              key={evt.id}
              className={`rounded-lg border p-2 ${colorForStatus(evt.status)} ${
                evt.status === "running" ? "shadow-[0_0_14px_rgba(163,216,244,0.12)]" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs md:text-sm flex items-center gap-2">
                  {evt.status === "running" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-light-blue animate-pulse" />
                  )}
                  {evt.label}
                </p>
                <div className="text-right">
                  <p className="text-[10px] md:text-xs uppercase">{evt.status}</p>
                  <p className="text-[10px] text-white/55">{formatElapsed(evt.atMs - originMs)}</p>
                </div>
              </div>
              {typeof evt.parallelGroup === "number" && (
                <p className="text-[10px] md:text-xs opacity-80 mt-1">Parallel group {evt.parallelGroup}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
