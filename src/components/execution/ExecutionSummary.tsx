import { useState } from "react";
import type { ExecutionSummaryData } from "@/lib/executionModel";

type ExecutionSummaryProps = {
  data: ExecutionSummaryData | null;
};

function formatDuration(ms: number): string {
  if (ms <= 0) return "-";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export function ExecutionSummary({ data }: ExecutionSummaryProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm md:text-base font-semibold text-neon-pink">Execution Summary</span>
        <span className="text-xs text-white/60">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {!data ? (
            <p className="text-xs md:text-sm text-white/50">
              Summary will appear after execution is delivered.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider mb-1">Total Cost</p>
                <p className="text-sm md:text-base text-white">{data.totalCost}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider mb-1">Duration</p>
                <p className="text-sm md:text-base text-white">{formatDuration(data.durationMs)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider mb-1">Tasks Executed</p>
                <p className="text-sm md:text-base text-white">{data.tasksExecuted}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider mb-1">Parallelization</p>
                <p className="text-sm md:text-base text-white">{data.parallelGroups} groups</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3 md:col-span-2">
                <p className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider mb-1">Capabilities Used</p>
                <div className="flex flex-wrap gap-2">
                  {data.capabilities.map((cap) => (
                    <span key={cap} className="px-2 py-1 rounded-md text-[10px] md:text-xs border border-light-blue/30 bg-light-blue/10 text-light-blue">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider mb-1">Settlement</p>
                <p className="text-sm md:text-base text-white">{data.settlement}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider mb-1">Validation</p>
                <p className={`text-sm md:text-base ${data.validation === "pass" ? "text-green-300" : "text-red-300"}`}>
                  {data.validation === "pass" ? "Pass" : "Fail"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
