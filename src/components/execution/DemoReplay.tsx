type ExecutionMode = "standard" | "pro";

type DemoReplayProps = {
  onRunReplay: () => void;
  running: boolean;
  demoResult: string | null;
  videoUrl?: string;
  executionMode?: ExecutionMode;
};

export function DemoReplay({ onRunReplay, running, demoResult, videoUrl, executionMode }: DemoReplayProps) {
  const mode: ExecutionMode = executionMode === "pro" ? "pro" : "standard";

  return (
    <div
      className={`rounded-2xl border backdrop-blur-sm p-4 md:p-5 transition-colors duration-300 ${
        mode === "pro"
          ? "border-neon-pink/50 bg-neon-pink/10 shadow-[0_0_28px_rgba(255,123,198,0.35)]"
          : "border-white/10 bg-black/25 opacity-80"
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-sm md:text-base font-semibold bg-gradient-to-r from-light-blue via-neon-pink to-light-blue bg-clip-text text-transparent">
          Demo / Replay
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider">
            Watch a real quest
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] md:text-[10px] uppercase tracking-wide border ${
              mode === "pro"
                ? "border-neon-pink/60 bg-neon-pink/15 text-neon-pink"
                : "border-white/20 bg-black/40 text-white/40"
            }`}
          >
            {mode === "pro" ? "Pro Preview" : "Unavailable in Standard"}
          </span>
        </div>
      </div>

      {videoUrl && mode === "pro" ? (
        <div className="mb-4">
          <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10 bg-black">
            <iframe
              title="Nexus quest demo"
              src={videoUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <p className="text-xs md:text-sm mb-3 text-white/45">
          {mode === "pro"
            ? "No demo video URL configured. Use local replay to show orchestration on-site."
            : "Demo / Replay is a Pro-only preview feature. It will unlock with $NXS at launch."}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRunReplay}
          disabled={running || mode === "standard"}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 border ${
            mode === "pro"
              ? "border-neon-pink/60 bg-neon-pink/25 text-neon-pink hover:bg-neon-pink/35"
              : "border-white/15 bg-black/40 text-white/40 cursor-not-allowed"
          }`}
        >
          {running ? "Replay Running..." : mode === "pro" ? "Run Demo Replay" : "Replay (Pro only)"}
        </button>
        <span className="text-xs text-white/50">
          {mode === "pro"
            ? "Replay does not trigger payment or backend calls."
            : "Upgrade to Pro Execution to enable in-app demo replay."}
        </span>
      </div>

      {demoResult && (
        <div className="mt-3 p-3 rounded-lg border border-light-blue/30 bg-light-blue/10 text-white/85 text-sm">
          {demoResult}
        </div>
      )}
    </div>
  );
}
