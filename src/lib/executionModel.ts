export type QuestMode = "text" | "image" | "trailer";

export type ExecutionPhase =
  | "Interpretation"
  | "Planning"
  | "Running"
  | "Verification"
  | "Assembly"
  | "Delivered";

export type MonitorStatus = "queued" | "running" | "done" | "failed";

export type PlanStep = {
  id: string;
  label: string;
  status?: MonitorStatus;
  parallelGroup?: number;
};

export type PreviewPlan = {
  steps: PlanStep[];
  capabilities: string[];
  estimateRange: string;
  parallelGroups: number;
  settlementNote: string;
};

export type MonitorEvent = {
  id: string;
  phase: ExecutionPhase;
  label: string;
  status: MonitorStatus;
  parallelGroup?: number;
  atMs: number;
};

export type ExecutionSummaryData = {
  totalCost: string;
  durationMs: number;
  tasksExecuted: number;
  parallelGroups: number;
  capabilities: string[];
  settlement: string;
  validation: "pass" | "fail";
};

function inferCapabilities(mode: QuestMode, input: string): string[] {
  const normalized = input.toLowerCase();
  const base = ["Text", "Verify"];
  if (mode === "image") return ["Text", "Vision", "Verify"];
  if (mode === "trailer") return ["Text", "Vision", "Audio", "Video", "Verify"];
  if (/\b(image|photo|visual|illustration)\b/.test(normalized)) {
    return ["Text", "Vision", "Verify"];
  }
  return base;
}

function estimateRange(mode: QuestMode): string {
  if (mode === "trailer") return "0.02 - 0.08 USDC";
  if (mode === "image") return "0.02 - 0.05 USDC";
  return "0.02 - 0.03 USDC";
}

export function buildPreviewPlan(input: string, mode: QuestMode): PreviewPlan {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      steps: [],
      capabilities: inferCapabilities(mode, input),
      estimateRange: estimateRange(mode),
      parallelGroups: 0,
      settlementNote: "Settled once via x402",
    };
  }

  const tokenCount = trimmed.split(/\s+/).filter(Boolean).length;
  const isSimpleRequest = tokenCount <= 12;
  const isMediumRequest = tokenCount > 12 && tokenCount <= 30;

  const common: PlanStep[] = [
    { id: "interpret", label: "Interpret intent", parallelGroup: 1 },
    { id: "plan", label: "Build execution plan", parallelGroup: 1 },
  ];

  let middle: PlanStep[];
  if (mode === "trailer") {
    middle = [
      { id: "storyboard", label: "Outline storyboard", parallelGroup: 2 },
      { id: "prompt", label: "Generate prompts", parallelGroup: 2 },
      { id: "render", label: "Render trailer assets", parallelGroup: 3 },
      { id: "audio", label: "Sync motion/audio", parallelGroup: 3 },
    ];
  } else if (mode === "image") {
    middle = isSimpleRequest
      ? [{ id: "render", label: "Render image", parallelGroup: 2 }]
      : [
          { id: "prompt", label: "Generate visual prompts", parallelGroup: 2 },
          { id: "render", label: "Render image candidates", parallelGroup: 3 },
        ];
  } else {
    if (isSimpleRequest) {
      middle = [{ id: "execute", label: "Execute", parallelGroup: 2 }];
    } else if (isMediumRequest) {
      middle = [
        { id: "compose", label: "Compose task graph", parallelGroup: 2 },
        { id: "execute", label: "Execute capabilities", parallelGroup: 3 },
      ];
    } else {
      middle = [
        { id: "compose", label: "Compose task graph", parallelGroup: 2 },
        { id: "execute", label: "Execute capabilities", parallelGroup: 3 },
      ];
    }
  }

  let tail: PlanStep[];
  if (mode === "trailer") {
    tail = [
      { id: "verify", label: "Verify outputs", parallelGroup: 4 },
      { id: "assemble", label: "Assemble final answer", parallelGroup: 4 },
    ];
  } else if (isSimpleRequest) {
    tail = [{ id: "assemble", label: "Assemble answer", parallelGroup: 2 }];
  } else if (isMediumRequest) {
    tail = [
      { id: "verify", label: "Verify", parallelGroup: 3 },
      { id: "assemble", label: "Assemble answer", parallelGroup: 3 },
    ];
  } else {
    tail = [
      { id: "verify", label: "Verify outputs", parallelGroup: 4 },
      { id: "assemble", label: "Assemble final answer", parallelGroup: 4 },
    ];
  }

  const steps = [...common, ...middle, ...tail].slice(0, 8);
  const groupSet = new Set(steps.map((s) => s.parallelGroup).filter(Boolean));

  return {
    steps,
    capabilities: inferCapabilities(mode, input),
    estimateRange: estimateRange(mode),
    parallelGroups: groupSet.size,
    settlementNote: "Settled once via x402",
  };
}

export function createReplayEvents(mode: QuestMode): MonitorEvent[] {
  const base: MonitorEvent[] = [
    { id: "e1", phase: "Interpretation", label: "Interpret request", status: "running", atMs: 200 },
    { id: "e2", phase: "Interpretation", label: "Interpret request", status: "done", atMs: 900 },
    { id: "e3", phase: "Planning", label: "Build plan", status: "running", atMs: 1000 },
    { id: "e4", phase: "Planning", label: "Build plan", status: "done", atMs: 1650 },
  ];

  const parallel =
    mode === "trailer"
      ? [
          { id: "e5", phase: "Running" as const, label: "Generate prompts", status: "running" as const, atMs: 1800, parallelGroup: 1 },
          { id: "e6", phase: "Running" as const, label: "Outline storyboard", status: "running" as const, atMs: 1800, parallelGroup: 1 },
          { id: "e7", phase: "Running" as const, label: "Generate prompts", status: "done" as const, atMs: 2500, parallelGroup: 1 },
          { id: "e8", phase: "Running" as const, label: "Outline storyboard", status: "done" as const, atMs: 2600, parallelGroup: 1 },
          { id: "e9", phase: "Running" as const, label: "Render trailer", status: "running" as const, atMs: 2800, parallelGroup: 2 },
          { id: "e10", phase: "Running" as const, label: "Render trailer", status: "done" as const, atMs: 4200, parallelGroup: 2 },
        ]
      : [
          { id: "e5", phase: "Running" as const, label: "Execute capabilities", status: "running" as const, atMs: 1800, parallelGroup: 1 },
          { id: "e6", phase: "Running" as const, label: "Execute capabilities", status: "done" as const, atMs: 3000, parallelGroup: 1 },
        ];

  const tail: MonitorEvent[] = [
    { id: "e11", phase: "Verification", label: "Validate result", status: "running", atMs: 4300 },
    { id: "e12", phase: "Verification", label: "Validate result", status: "done", atMs: 5000 },
    { id: "e13", phase: "Assembly", label: "Assemble response", status: "running", atMs: 5200 },
    { id: "e14", phase: "Assembly", label: "Assemble response", status: "done", atMs: 5800 },
    { id: "e15", phase: "Delivered", label: "Delivered", status: "done", atMs: 6100 },
  ];

  return [...base, ...parallel, ...tail];
}

export function phaseFromStatusLine(line: string): ExecutionPhase {
  const l = line.toLowerCase();
  if (l.includes("wallet") || l.includes("sending request")) return "Planning";
  if (l.includes("payment")) return "Verification";
  if (l.includes("response received")) return "Delivered";
  if (l.includes("error")) return "Assembly";
  return "Running";
}
