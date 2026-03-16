type ExecutionMode = "standard" | "pro";

type ExecutionClassPanelProps = {
  mode: ExecutionMode;
};

export function ExecutionClassPanel({ mode }: ExecutionClassPanelProps) {
  const isPro = mode === "pro";

  return (
    <div className="mb-5 md:mb-6 rounded-3xl border border-white/10 bg-black/30 backdrop-blur-sm px-3 py-3 md:px-4 md:py-4">
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <div
            className={`relative rounded-2xl border bg-black/50 px-3 py-3 md:px-4 md:py-4 transition-all duration-300 ${
              isPro
                ? "border-white/15 text-white/75"
                : "border-white/25 bg-white/5 text-white shadow-[0_0_26px_rgba(255,255,255,0.10)]"
            }`}
          >
            <div className="flex flex-col items-start gap-2 mb-2">
              <p className="text-xs md:text-sm font-semibold text-white">
                Standard Execution
              </p>
              <p className="text-[11px] md:text-xs text-white/55">
                Core structured execution for everyday tasks.
              </p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/20 text-[10px] md:text-[11px] text-white/60 uppercase tracking-wide">
                Standard
              </span>
            </div>
            <ul className="mt-3 space-y-1.5 text-[11px] md:text-xs text-white/75">
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-white/60" />
                <span>Structured execution</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-white/60" />
                <span>Core AI models</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-white/60" />
                <span>Single-lane orchestration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-white/60" />
                <span>Standard context memory</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-white/60" />
                <span>Basic export formats</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-white/60" />
                <span>Standard routing speed</span>
              </li>
            </ul>
          </div>

          <div
            className={`relative rounded-2xl border px-3 py-3 md:px-4 md:py-4 transition-all duration-300 ${
              isPro
                ? "border-neon-pink/60 bg-gradient-to-br from-neon-pink/15 via-black/60 to-light-blue/10 shadow-[0_0_32px_rgba(255,123,198,0.35)]"
                : "border-neon-pink/25 bg-gradient-to-br from-neon-pink/8 via-black/60 to-light-blue/5"
            }`}
          >
            {isPro && (
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-neon-pink/10 via-transparent to-light-blue/10 opacity-70" />
            )}
            <div className="relative flex flex-col items-start gap-2 mb-2">
              <p className="text-xs md:text-sm font-semibold text-white text-left md:text-center">
                Pro Execution
              </p>
              <p className="text-[11px] md:text-xs text-white/70 text-left md:text-center">
                Advanced orchestration tier for power users.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-neon-pink/60 bg-black/40 text-[10px] md:text-[11px] text-neon-pink uppercase tracking-wide">
                  Pro
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-neon-pink/20 text-[9px] md:text-[10px] text-neon-pink uppercase tracking-wide border border-neon-pink/50">
                  $NXS Required
                </span>
              </div>
            </div>
            <ul className="relative mt-3 space-y-1.5 text-[11px] md:text-xs text-white/85">
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-neon-pink" />
                <span>Premium AI models (latest tier)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-neon-pink" />
                <span>Multi-agent collaborative orchestration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-neon-pink" />
                <span>Extended context memory</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-neon-pink" />
                <span>High-fidelity multimodal generation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-neon-pink" />
                <span>Faster execution routing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-neon-pink" />
                <span>Professional export formats (PDF / DOCX / PPTX)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-[6px] h-1 w-1 rounded-full bg-neon-pink" />
                <span>Higher compute allocation</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

