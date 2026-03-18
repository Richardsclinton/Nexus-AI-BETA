import { buildPreviewPlan, type QuestMode } from "@/lib/executionModel";

type ExecutionPlanPreviewProps = {
  input: string;
  mode: QuestMode;
  executionMode?: "standard" | "pro";
};

export function ExecutionPlanPreview({ input, mode, executionMode }: ExecutionPlanPreviewProps) {
  const plan = buildPreviewPlan(input, mode);
  const hasInput = input.trim().length > 0;
  const tier = executionMode === "pro" ? "pro" : "standard";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-sm md:text-base font-semibold text-neon-pink">
          Execution Plan Preview
        </h4>
        <span className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider" title="Quest = one complete orchestrated execution">
          Quest preview
        </span>
      </div>

      {!hasInput ? (
        <p className="text-xs md:text-sm text-white/55">
          Start typing in any input (text / image / trailer) to preview orchestration steps.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 mb-4">
            <p className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider mb-1">
              Execution Tier
            </p>
            <p className="text-xs md:text-sm text-white">
              {tier === "pro" ? "Premium Model Stack" : "Core Model Stack"}
            </p>
            {tier === "pro" ? (
              <p className="text-[10px] md:text-xs text-neon-pink/80 mt-1">
                Extended context window enabled • High-fidelity multimodal routing.
              </p>
            ) : (
              <p className="text-[10px] md:text-xs text-white/55 mt-1">
                Core structured execution for everyday Quests.
              </p>
            )}
          </div>

          <div className="space-y-2 mb-4">
            {plan.steps.map((step, idx) => (
              <div key={step.id} className="flex items-start gap-2 text-xs md:text-sm text-white/80">
                <span className="mt-0.5 w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-[10px] text-white/70">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p>{step.label}</p>
                  {typeof step.parallelGroup === "number" && (
                    <p className="text-[10px] md:text-xs text-light-blue/80">
                      Parallel group {step.parallelGroup}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider mb-2">Capabilities</p>
              <div className="flex flex-wrap gap-2">
                {plan.capabilities.map((c) => (
                  <span
                    key={c}
                    className="px-2 py-1 rounded-md text-[10px] md:text-xs border border-neon-pink/30 bg-neon-pink/10 text-neon-pink"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-[10px] md:text-xs text-white/50 uppercase tracking-wider mb-1">
                Execution Cost
              </p>
              <p className="text-sm md:text-base text-white">0.05 USDC per Quest</p>
              <p className="text-[10px] md:text-xs text-light-blue/80 mt-1">
                Settled once via x402.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
