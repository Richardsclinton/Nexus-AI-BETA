type ExecutionMode = "standard" | "pro";

type ExecutionModeSelectorProps = {
  mode: ExecutionMode;
  onChange: (mode: ExecutionMode) => void;
};

export function ExecutionModeSelector({ mode, onChange }: ExecutionModeSelectorProps) {
  const isStandard = mode === "standard";
  const isPro = mode === "pro";

  return (
    <div className="mb-4 md:mb-5 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm px-3 py-3 md:px-4 md:py-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1 max-w-xl">
          <p className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
            Execution Mode
          </p>
          <p className="text-[11px] md:text-xs text-white/45 leading-snug">
            Standard is available to everyone. Pro is a premium execution tier that will be unlocked by holding
            {" "}<span className="font-semibold text-white/70">$NXS</span> at launch.
          </p>
        </div>

        <div className="flex items-center gap-2 mt-2 md:mt-0">
          <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => onChange("standard")}
              className={`px-3 md:px-4 py-1.5 text-[11px] md:text-xs rounded-full font-medium transition-all duration-200 ${
                isStandard
                  ? "bg-gradient-to-r from-light-blue via-neon-pink to-light-blue text-black shadow-[0_0_18px_rgba(163,216,244,0.45)]"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => onChange("pro")}
              className={`px-3 md:px-4 py-1.5 text-[11px] md:text-xs rounded-full font-medium flex items-center gap-1.5 transition-all duration-200 ${
                isPro
                  ? "bg-neon-pink/20 text-neon-pink border border-neon-pink/40 shadow-[0_0_18px_rgba(255,123,198,0.45)]"
                  : "text-white/70 hover:text-white border border-transparent"
              }`}
              title="Pro mode will be token-gated with $NXS at launch. (UI preview)"
            >
              <span>Pro</span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-wide ${
                  isPro ? "bg-neon-pink/30 text-black" : "bg-white/10 text-white/60"
                }`}
              >
                Preview
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

