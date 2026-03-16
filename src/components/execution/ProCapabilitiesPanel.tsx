import { useState } from "react";

type ExecutionMode = "standard" | "pro";

type ProCapabilitiesPanelProps = {
  mode: ExecutionMode;
};

const PRO_FEATURES: { id: string; label: string; description?: string }[] = [
  {
    id: "parallel",
    label: "Parallel Execution (2–3 lanes)",
    description: "Run multiple execution lanes in parallel for complex Quests.",
  },
  {
    id: "verification",
    label: "Advanced Verification",
    description: "Extra validation passes on orchestrated steps and outputs.",
  },
  {
    id: "ingestion",
    label: "Larger File Ingestion",
    description: "Ingest and reason over larger documents and artifacts.",
  },
  {
    id: "export",
    label: "Professional Export (PDF/DOCX/PPTX)",
    description: "Export execution outcomes into professional formats.",
  },
  {
    id: "priority",
    label: "Priority Queue",
    description: "Priority execution lane during periods of high demand.",
  },
];

export function ProCapabilitiesPanel({ mode }: ProCapabilitiesPanelProps) {
  const [open, setOpen] = useState(true);
  const isProPreview = mode === "pro";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 backdrop-blur-sm mb-6 [transform:scale(1)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors duration-200 rounded-t-2xl scale-100 hover:scale-100 active:scale-100"
      >
        <div className="flex items-center gap-2 scale-100">
          <span className="text-sm md:text-base font-semibold text-white">What Pro unlocks</span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] md:text-xs uppercase tracking-wide ${
              isProPreview
                ? "bg-neon-pink/20 text-neon-pink border border-neon-pink/40"
                : "bg-white/10 text-white/60 border border-white/20"
            }`}
          >
            {isProPreview ? "Preview" : "Pro"}
          </span>
        </div>
        <span className="text-xs text-white/60">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2">
          <p className="text-[11px] md:text-xs text-white/60 mb-1.5">
            Pro is not just faster. It runs on a higher execution tier.
          </p>
          {PRO_FEATURES.map((feature) => (
            <div
              key={feature.id}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
                isProPreview
                  ? "border-neon-pink/40 bg-neon-pink/10 text-white shadow-[0_0_24px_rgba(255,123,198,0.25)]"
                  : "border-white/12 bg-black/40 text-white/55"
              }`}
            >
              <div
                className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  isProPreview
                    ? "border-neon-pink/60 bg-neon-pink/25 text-neon-pink"
                    : "border-white/25 bg-black/40 text-white/55"
                }`}
              >
                {isProPreview ? "ON" : "PRO"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs md:text-sm truncate">{feature.label}</p>
                  <span
                    className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-wide ${
                      isProPreview
                        ? "bg-black/40 text-neon-pink border border-neon-pink/40"
                        : "bg-black/30 text-white/50 border border-white/20"
                    }`}
                  >
                    {isProPreview ? "Preview" : "Pro"}
                  </span>
                </div>
                {feature.description && (
                  <p className="mt-1 text-[11px] md:text-xs text-white/60">
                    {feature.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

