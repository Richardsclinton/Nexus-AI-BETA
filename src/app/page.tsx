"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect, Fragment, ChangeEvent, useMemo, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import AILogosMarquee from "@/components/AILogosMarquee";
import { v4 as uuidv4 } from "uuid";

// Dynamic import pour composant non critique au chargement initial (CenteredOverlay en import normal pour éviter erreur prerender /500)
const NeuralLineConnector = dynamic(() => import("@/components/NeuralLineConnector"), {
  ssr: false,
  loading: () => null,
});
import { CenteredOverlay } from "@/components/CenteredOverlay";
import { createPaidFetchFromConnectedWallet } from "@/lib/x402/browserPaidFetch";
import {
  sendUsdcTransferAndGetTxHash,
  getWalletReadiness,
  warmUpProvider,
} from "@/lib/x402/txHashWalletPayment";
import {
  savePendingPayment,
  getPendingPayment,
  clearPendingPayment,
} from "@/lib/x402/pendingPaymentStorage";
import { getSelectedProvider, rehydrateProvider } from "@/lib/walletProviderStore";
import { setSelectedProvider } from "@/lib/walletProviderStore";
import { ExecutionPlanPreview } from "@/components/execution/ExecutionPlanPreview";
import { ExecutionMonitor } from "@/components/execution/ExecutionMonitor";
import { ExecutionSummary } from "@/components/execution/ExecutionSummary";
import { DemoReplay } from "@/components/execution/DemoReplay";
import { ExecutionModeSelector } from "@/components/execution/ExecutionModeSelector";
import { ExecutionClassPanel } from "@/components/execution/ExecutionClassPanel";
import { ProCapabilitiesPanel } from "@/components/execution/ProCapabilitiesPanel";
import {
  buildPreviewPlan,
  createReplayEvents,
  phaseFromStatusLine,
  type QuestMode,
  type MonitorEvent,
  type ExecutionPhase,
  type ExecutionSummaryData,
} from "@/lib/executionModel";

type ChatResponse = {
  reply?: string;
  error?: string | boolean;
  message?: string;
  mode?: "trailer" | "chat" | "image";
  videoUrl?: string;
  imageUrl?: string;
  seed?: string | number;
  actualPrompt?: string;
  status?: number;
  details?: string;
};

const PREMIUM_PACK_TEXT = "Your request requires the premium pack";
const PREMIUM_PACK_DISPLAY = "This request is not available in the current plan.";
const PAYMENT_CANCELLED_DISPLAY = "Payment was cancelled before execution.";

type SpeechRecognitionCtor = (new () => {
  start(): void;
  stop(): void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { resultIndex: number; results: Array<{ isFinal: boolean; 0?: { transcript?: string }; length: number }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}) | null;

type SubmitMessageFn = ((request: string, forceTrailer?: boolean, options?: { imageOnly?: boolean }) => Promise<void>) | null;
type RecognitionRef = { start(): void; stop(): void } | null;

type HistoryEntry = {
  id: string;
  request: string;
  timestamp: Date;
  orchestratorActions: string[];
  aiModels: string[];
  response?: string;
  mode?: "trailer" | "image" | "chat";
  videoUrl?: string;
  imageUrl?: string;
};

export default function EnterNexusPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const executionBottomRef = useRef<HTMLElement>(null);
  const sectionRefs = [heroRef];
  const [showExecutionLayersInfo, setShowExecutionLayersInfo] = useState(false);
  type OpenPanel = "history" | "orchestration" | "plan" | "replay" | "advanced" | null;
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [currentExampleSet, setCurrentExampleSet] = useState(0);
  const NEXUS_HISTORY_STORAGE_KEY = "nexus_history";
  const NEXUS_FAILURE_COUNT_KEY = "nexus_failure_count";

  const chatHoverAudioContextRef = useRef<AudioContext | null>(null);

  /** Joue un son d'alerte (beep) via Web Audio. */
  const playAlertSound = () => {
    if (typeof window === "undefined") return;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // ignore
    }
  };

  const playChatHoverSound = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const AudioContextClass =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx: AudioContext =
        chatHoverAudioContextRef.current ?? new AudioContextClass();
      if (!chatHoverAudioContextRef.current) chatHoverAudioContextRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(720, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // ignore if audio not allowed
    }
  }, []);

  // Quand le mot de passe d’historique est raté :
  // on garde uniquement la logique interne (compteur + reset / suppression après 3 échecs),
  // sans vidéo ni script “2 chances / 1 chance”.
  const trackFailure = () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(NEXUS_FAILURE_COUNT_KEY);
    const prev = raw ? Math.min(3, parseInt(raw, 10) || 0) : 0;
    const count = prev + 1;
    localStorage.setItem(NEXUS_FAILURE_COUNT_KEY, String(count));

    if (count >= 3) {
      setHistory([]);
      try {
        localStorage.removeItem(NEXUS_HISTORY_STORAGE_KEY);
      } catch {
        // ignore
      }
      localStorage.setItem(NEXUS_FAILURE_COUNT_KEY, "0");
      try {
        sessionStorage.removeItem("nexus_history_code");
      } catch {
        // ignore
      }
      setHasCodeSet(false);
      setHistoryUnlocked(false);
      setHistoryCodeInput("");
      setHistoryCodeConfirm("");
      setHistoryCodeError(null);
    }
  };

  const recordFailureAndSetError = (_message: string) => {
    trackFailure();

    // Message unique côté UI pour toutes les requêtes non réalisables.
    const errorText = PREMIUM_PACK_DISPLAY;
    setLlmError(errorText);

    // Mettre à jour la première entrée d'historique pour refléter un échec :
    // - garder la requête
    // - vider orchestratorActions et aiModels
    // - stocker le message d'erreur Nexus AI comme réponse.
    setHistory((prev) => {
      if (!prev || prev.length === 0) return prev;
      const [first, ...rest] = prev;
      return [
        {
          ...first,
          orchestratorActions: [],
          aiModels: [],
          response: errorText,
        },
        ...rest,
      ];
    });

    // Restaurer la requête dans le champ de saisie pour éviter à l'utilisateur de tout réécrire
    if (typeof window !== "undefined") {
      const inputId = lastInputIdRef.current ?? "nexus-chat-input";
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      // On réutilise la dernière requête connue si disponible
      if (input && pendingRequestRef.current) {
        input.value = pendingRequestRef.current;
      }
    }
  };

  const resetFailureCount = () => {
    if (typeof window !== "undefined") localStorage.setItem(NEXUS_FAILURE_COUNT_KEY, "0");
  };

  const loadHistoryFromStorage = (): Array<HistoryEntry> => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(NEXUS_HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<{ timestamp: string; [k: string]: unknown }>;
      if (!Array.isArray(parsed)) return [];
      return parsed.map((e) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })) as Array<HistoryEntry>;
    } catch {
      return [];
    }
  };

  const [history, setHistory] = useState<Array<HistoryEntry> >(loadHistoryFromStorage);
  const [hasValidatedCurrentResponse, setHasValidatedCurrentResponse] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  /** Mode txHash (X402_MODE=txhash) : requirements du 402 pour afficher payTo + input txHash. */
  const [txHashRequirements, setTxHashRequirements] = useState<{
    payTo?: string;
    asset?: string;
    amount?: string;
    network?: string;
    x402Mode?: string;
    paymentError?: string;
  } | null>(null);
  const [txHashPaymentPending, setTxHashPaymentPending] = useState(false);
  const [hasTxHashForRetry, setHasTxHashForRetry] = useState(false);
  const [paymentConfirmingExhausted, setPaymentConfirmingExhausted] = useState(false);
  const lastTxHashForRetryRef = useRef<string | null>(null);
  const [walletReadiness, setWalletReadiness] = useState<{
    ready: boolean;
    code?: "no_provider" | "wrong_network" | "no_address";
  } | null>(null);
  const recoveredFromStorageRef = useRef(false);
  const [showMetaMaskSimulation, setShowMetaMaskSimulation] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [llmResponse, setLlmResponse] = useState<string | null>(null);
  const [llmMode, setLlmMode] = useState<"trailer" | "chat" | "image" | null>(null);
  const [llmImageUrl, setLlmImageUrl] = useState<string | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string[]>([]);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generationLoading, setGenerationLoading] = useState(false);
  const pendingRequestRef = useRef<string | null>(null);
  const pendingMessageRef = useRef<string | null>(null);
  const pendingReferenceImageRef = useRef<string | null>(null);
  const pendingIdempotencyKeyRef = useRef<string | null>(null);
  const pendingIsTrailerRef = useRef<boolean>(false);
  const pendingChatTypeRef = useRef<string | null>(null);
  const lastInputIdRef = useRef<string | null>(null);
  const submitMessageRef = useRef<SubmitMessageFn>(null);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [referenceFileName, setReferenceFileName] = useState<string | null>(null);
  const [uploadingReference, setUploadingReference] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceNotSupported, setVoiceNotSupported] = useState(false);
  const speechTranscriptRef = useRef<string>("");
  const recognitionRef = useRef<RecognitionRef>(null);
  const [historyUnlocked, setHistoryUnlocked] = useState(false);
  const [historyCodeInput, setHistoryCodeInput] = useState("");
  const [historyCodeError, setHistoryCodeError] = useState<string | null>(null);
  const [hasCodeSet, setHasCodeSet] = useState(false);
  const [historyCodeConfirm, setHistoryCodeConfirm] = useState("");
  const [historyCodeMounted, setHistoryCodeMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [executionMode, setExecutionMode] = useState<"standard" | "pro">("standard");
  const [chatDraft, setChatDraft] = useState("");
  const [imageDraft, setImageDraft] = useState("");
  const [trailerDraft, setTrailerDraft] = useState("");
  const [activeQuestMode, setActiveQuestMode] = useState<QuestMode>("text");
  const [liveEvents, setLiveEvents] = useState<MonitorEvent[]>([]);
  const [replayEvents, setReplayEvents] = useState<MonitorEvent[]>([]);
  const [replayRunning, setReplayRunning] = useState(false);
  const [demoResult, setDemoResult] = useState<string | null>(null);
  const [executionSummary, setExecutionSummary] = useState<ExecutionSummaryData | null>(null);
  const [lastQuestMeta, setLastQuestMeta] = useState<{
    input: string;
    mode: QuestMode;
    startedAt: number;
  } | null>(null);
  const replayTimeoutsRef = useRef<number[]>([]);
  const prevGenerationStatusLenRef = useRef(0);
  const prevLoadingRef = useRef(false);
  const lastSummarizedStartRef = useRef<number | null>(null);
  const demoVideoUrl = process.env.NEXT_PUBLIC_QUEST_DEMO_URL;

  // Optimize: use ref to avoid re-creating listener on every render
  const isMobileRef = useRef(false);
  const isNarrowRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const w = window.innerWidth;
      const mobile = w <= 1024;
      const narrow = w <= 360;
      if (mobile !== isMobileRef.current) {
        isMobileRef.current = mobile;
        setIsMobile(mobile);
      }
      if (narrow !== isNarrowRef.current) {
        isNarrowRef.current = narrow;
        setIsNarrowScreen(narrow);
      }
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    return () => {
      replayTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
      replayTimeoutsRef.current = [];
    };
  }, []);

  const currentPreviewInput =
    activeQuestMode === "trailer"
      ? trailerDraft
      : activeQuestMode === "image"
      ? imageDraft
      : chatDraft;

  const monitorEvents = replayRunning || replayEvents.length > 0 ? replayEvents : liveEvents;
  const monitorRunning = replayRunning || llmLoading || generationLoading;
  const currentPhase: ExecutionPhase = useMemo(() => {
    if (replayEvents.length > 0) {
      return replayEvents[replayEvents.length - 1]?.phase ?? "Interpretation";
    }
    if (llmResponse && !llmLoading && !generationLoading) return "Delivered";
    if (llmError && !llmLoading && !generationLoading) return "Assembly";
    if (generationStatus.length > 0) {
      return phaseFromStatusLine(generationStatus[generationStatus.length - 1]);
    }
    if (llmLoading || generationLoading) return "Running";
    return "Interpretation";
  }, [replayEvents, llmResponse, llmLoading, generationLoading, llmError, generationStatus]);

  const progress = useMemo(() => {
    const idx = ["Interpretation", "Planning", "Running", "Verification", "Assembly", "Delivered"].indexOf(currentPhase);
    if (idx < 0) return 0;
    const base = Math.round(((idx + 1) / 6) * 100);
    return monitorRunning && currentPhase !== "Delivered" ? Math.max(8, base - 8) : base;
  }, [currentPhase, monitorRunning]);

  useEffect(() => {
    const isLoading = llmLoading || generationLoading;
    if (isLoading && !prevLoadingRef.current) {
      setDemoResult(null);
      setReplayEvents([]);
      setLiveEvents([
        {
          id: `start-${Date.now()}`,
          phase: "Interpretation",
          label: "Execution started",
          status: "running",
          atMs: 0,
        },
      ]);
    }
    prevLoadingRef.current = isLoading;
  }, [llmLoading, generationLoading]);

  useEffect(() => {
    if (generationStatus.length <= prevGenerationStatusLenRef.current) return;
    const newLines = generationStatus.slice(prevGenerationStatusLenRef.current);
    prevGenerationStatusLenRef.current = generationStatus.length;
    setLiveEvents((prev) => [
      ...prev,
      ...newLines.map((line, idx) => {
        const status: MonitorEvent["status"] = line.toLowerCase().startsWith("error")
          ? "failed"
          : "running";
        return {
          id: `status-${Date.now()}-${idx}`,
          phase: phaseFromStatusLine(line),
          label: line,
          status,
          atMs: Date.now(),
        };
      }),
    ]);
  }, [generationStatus]);

  useEffect(() => {
    if (llmResponse && !llmLoading && !generationLoading) {
      setLiveEvents((prev) => [
        ...prev,
        {
          id: `delivered-${Date.now()}`,
          phase: "Delivered",
          label: "Result delivered",
          status: "done",
          atMs: Date.now(),
        },
      ]);
    }
  }, [llmResponse, llmLoading, generationLoading]);

  useEffect(() => {
    if (llmError && !llmLoading && !generationLoading) {
      setLiveEvents((prev) => [
        ...prev,
        {
          id: `failed-${Date.now()}`,
          phase: "Assembly",
          label: "Execution failed",
          status: "failed",
          atMs: Date.now(),
        },
      ]);
    }
  }, [llmError, llmLoading, generationLoading]);

  useEffect(() => {
    if (!lastQuestMeta) return;
    if (lastSummarizedStartRef.current === lastQuestMeta.startedAt) return;
    if (llmLoading || generationLoading) return;
    if (!llmResponse && !llmError) return;

    const plan = buildPreviewPlan(lastQuestMeta.input, lastQuestMeta.mode);
    const hasPaymentSignals = generationStatus.some((s) => s.toLowerCase().includes("payment"));
    setExecutionSummary({
      totalCost: "0.05 USDC",
      durationMs: Math.max(0, Date.now() - lastQuestMeta.startedAt),
      tasksExecuted: Math.max(plan.steps.length, 1),
      parallelGroups: Math.max(plan.parallelGroups, 1),
      capabilities: plan.capabilities,
      settlement: hasPaymentSignals ? "x402 (quote + proof verified)" : "x402 (single settlement)",
      validation: llmError ? "fail" : "pass",
    });
    lastSummarizedStartRef.current = lastQuestMeta.startedAt;
  }, [lastQuestMeta, llmLoading, generationLoading, llmResponse, llmError, generationStatus]);

  const runDemoReplay = useCallback(() => {
    replayTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
    replayTimeoutsRef.current = [];
    setReplayRunning(true);
    setReplayEvents([]);
    setDemoResult(null);

    const mode: QuestMode = activeQuestMode;
    const events = createReplayEvents(mode);
    events.forEach((evt) => {
      const timeout = window.setTimeout(() => {
        setReplayEvents((prev) => [...prev, evt]);
      }, evt.atMs);
      replayTimeoutsRef.current.push(timeout);
    });

    const endTimeout = window.setTimeout(() => {
      setReplayRunning(false);
      setDemoResult(
        mode === "trailer"
          ? "Demo replay complete: Nexus orchestrated storyboard + prompt generation in parallel, then rendered and validated the trailer."
          : mode === "image"
          ? "Demo replay complete: Nexus orchestrated visual prompt generation, rendering, and validation."
          : "Demo replay complete: Nexus interpreted, orchestrated capabilities, validated, and delivered the final response."
      );
      const plan = buildPreviewPlan(currentPreviewInput || "demo quest", mode);
      setExecutionSummary({
        totalCost: "0.05 USDC (demo)",
        durationMs: 6200,
        tasksExecuted: Math.max(plan.steps.length, 1),
        parallelGroups: Math.max(plan.parallelGroups, 1),
        capabilities: plan.capabilities,
        settlement: "x402 (demo replay - no payment)",
        validation: "pass",
      });
    }, 6300);
    replayTimeoutsRef.current.push(endTimeout);
  }, [activeQuestMode, currentPreviewInput]);

  // Mise en forme plus lisible des réponses textuelles :
  // - on découpe en paragraphes sur les doubles sauts de ligne
  // - chaque paragraphe est rendu avec un léger espacement
  const renderFormattedResponse = (text: string) => {
    if (!text) return null;
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (paragraphs.length === 0) {
      return <p className="mb-3">{text}</p>;
    }

    return paragraphs.map((p, idx) => (
      <p key={idx} className="mb-3">
        {p}
      </p>
    ));
  };

  const HISTORY_STORAGE_KEY = "nexus_history_code";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(HISTORY_STORAGE_KEY);
    setHasCodeSet(!!stored);
    setHistoryCodeMounted(true);
  }, []);

  // Optimize: only save to localStorage when history actually changes (not on every render)
  const historyStringRef = useRef<string>("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const newHistoryString = JSON.stringify(history);
      if (newHistoryString !== historyStringRef.current) {
        historyStringRef.current = newHistoryString;
        localStorage.setItem(NEXUS_HISTORY_STORAGE_KEY, newHistoryString);
      }
    } catch {
      // ignore quota or parse errors
    }
  }, [history]);

  // Wallet readiness gate: update when payment modal is open (txHash mode) so Pay is disabled until ready
  useEffect(() => {
    if (!showPaymentModal || !txHashRequirements || hasTxHashForRetry) {
      setWalletReadiness(null);
      return;
    }
    let cancelled = false;
    const check = async () => {
      const provider = getSelectedProvider();
      const r = await getWalletReadiness(provider as Parameters<typeof getWalletReadiness>[0]);
      if (!cancelled) {
        setWalletReadiness({ ready: r.ready, code: r.code });
      }
    };
    check();
    const t = setInterval(check, 1500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [showPaymentModal, txHashRequirements, hasTxHashForRetry]);

  // Restore pending payment from localStorage after reload (TTL 5 min)
  useEffect(() => {
    if (recoveredFromStorageRef.current) return;
    if (typeof window === "undefined") return;
    try {
      const pending = getPendingPayment();
      if (!pending) return;
      recoveredFromStorageRef.current = true;
      pendingMessageRef.current = pending.requestBody.message;
      pendingReferenceImageRef.current = pending.requestBody.referenceImageUrl ?? null;
      pendingIsTrailerRef.current = !!pending.requestBody.isTrailer;
      if (pending.idemKey) pendingIdempotencyKeyRef.current = pending.idemKey;
      lastTxHashForRetryRef.current = pending.txHash;
      setHasTxHashForRetry(true);
      setTxHashRequirements(
        pending.payTo
          ? { payTo: pending.payTo, x402Mode: "txhash" }
          : { x402Mode: "txhash" }
      );
      setShowPaymentModal(true);
      setLlmError(null);
      // Trigger retry on next tick so refs are set
      const chatApiPath = "/api/chat";
      const message = pending.requestBody.message;
      const refImage = pending.requestBody.referenceImageUrl ?? null;
      const isTrailer = !!pending.requestBody.isTrailer;
      const idemKey = pending.idemKey;
      const txHash = pending.txHash;
      setLlmLoading(true);
      (async () => {
        try {
          const body = {
            message,
            referenceImageUrl: refImage ?? undefined,
            ...(isTrailer ? { isTrailer: true, mode: "trailer" as const } : {}),
          };
          const res = await fetch(chatApiPath, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-PAYMENT": JSON.stringify({ txHash }),
              ...(idemKey ? { "Idempotency-Key": idemKey } : {}),
            },
            body: JSON.stringify(body),
          });
          let data: ChatResponse = {};
          try {
            data = (await res.json()) as ChatResponse;
          } catch {
            data = {};
          }
          const providerError = (data as any)?.error === true;
          const baseMessage =
            (data as any)?.message ?? data?.reply ?? (data as any)?.details ?? null;
          const uiMessage =
            baseMessage === PREMIUM_PACK_TEXT
              ? PAYMENT_CANCELLED_DISPLAY
              : baseMessage ?? PAYMENT_CANCELLED_DISPLAY;

          if (providerError) {
            // Réponse normalisée { error: true, message } depuis le backend
            setGeneratedVideoUrl(null);
            setGeneratedContent(null);
            recordFailureAndSetError(uiMessage);
            setLlmLoading(false);
            setGenerationLoading(false);
            return;
          }

          if (res.ok) {
            clearPendingPayment();
            setShowPaymentModal(false);
            setTxHashRequirements(null);
            lastTxHashForRetryRef.current = null;
            setHasTxHashForRetry(false);
            const reply = (data?.reply ?? uiMessage) || "";
            setLlmResponse(reply);
            setLlmMode(data?.mode === "trailer" ? "trailer" : data?.mode === "chat" ? "chat" : data?.mode === "image" ? "image" : null);
            setLlmImageUrl(data?.mode === "image" && typeof data?.imageUrl === "string" ? data.imageUrl : null);
            setHistory((prev) => {
              if (prev.length === 0) {
                return [
                  {
                    id: Date.now().toString(),
                    request: message,
                    timestamp: new Date(),
                    orchestratorActions: [],
                    aiModels: [],
                    response: reply,
                  },
                ];
              }
              return prev.map((ent, i) => (i === 0 ? { ...ent, response: reply } : ent));
            });
          }
        } catch (err) {
          console.error("[restore-payment] Error:", err);
          setLlmError("Failed to restore payment session.");
          setLlmLoading(false);
        } finally {
          setLlmLoading(false);
        }
      })();
    } catch (err) {
      console.error("[restore-payment] Setup error:", err);
      recoveredFromStorageRef.current = true;
    }
    // Intentionnel : exécution une seule fois au mount pour restore-payment. recordFailureAndSetError omis volontairement pour éviter de relancer l’effet à chaque render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleHistoryCodeSetup = () => {
    const code = historyCodeInput.replace(/\D/g, "").slice(0, 6);
    const confirm = historyCodeConfirm.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      setHistoryCodeError("Enter a 6-digit code.");
      return;
    }
    if (confirm !== code) {
      setHistoryCodeError("Codes do not match.");
      return;
    }
    sessionStorage.setItem(HISTORY_STORAGE_KEY, code);
    setHasCodeSet(true);
    setHistoryUnlocked(true);
    setHistoryCodeError(null);
    setHistoryCodeInput("");
    setHistoryCodeConfirm("");
  };

  const handleHistoryCodeSubmit = () => {
    const code = historyCodeInput.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      setHistoryCodeError("Enter a 6-digit code.");
      return;
    }
    const stored = typeof window !== "undefined" ? sessionStorage.getItem(HISTORY_STORAGE_KEY) : null;
    if (stored && code === stored) {
      resetFailureCount();
      setHistoryUnlocked(true);
      setHistoryCodeError(null);
      setHistoryCodeInput("");
    } else {
      trackFailure();
      setHistoryCodeError("Invalid code.");
      setHistoryCodeInput(code);
    }
  };

  const escapeCsvCell = (value: string): string => {
    const s = String(value ?? "").replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };

  const downloadHistoryCsv = () => {
    if (history.length === 0) return;
    const headers = ["Timestamp", "Request", "Response", "Orchestrator Actions", "AI Models"];
    const rows = history.map((entry) => [
      entry.timestamp instanceof Date ? entry.timestamp.toISOString() : String(entry.timestamp),
      entry.request ?? "",
      entry.response ?? "",
      (entry.orchestratorActions ?? []).join("; "),
      (entry.aiModels ?? []).join("; "),
    ]);
    const csvContent = [
      headers.map(escapeCsvCell).join(","),
      ...rows.map((row) => row.map(escapeCsvCell).join(",")),
    ].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Memoize agent arrays (constants, never change) - defined before submitMessage
  const TEXT_AGENTS = useMemo(() => [
    "Claude",
    "GPT-4",
    "Gemini",
    "Llama",
    "Mistral",
    "Cohere",
    "Grok",
    "Pi",
    "DeepSeek",
    "Qwen",
    "Command R",
    "Claude (reasoning)",
    "o1",
  ], []);
  const IMAGE_AGENTS = useMemo(() => [
    "Midjourney",
    "DALL·E",
    "Stable Diffusion",
    "Leonardo AI",
    "Ideogram",
    "Flux",
    "Imagen",
    "Firefly",
    "Kandinsky",
    "Cogito",
    "Playground",
    "Adobe Firefly",
    "Recraft",
  ], []);
  const TRAILER_AGENTS = useMemo(() => [
    "Runway",
    "Pika Labs",
    "Luma AI",
    "Kaiber",
    "Synthesia",
    "HeyGen",
    "D-ID",
    "Minimax",
    "Wan",
    "Sora",
    "Veo",
    "Kling",
    "LTX Video",
  ], []);

  // Memoize orchestrator pools (constants, never change)
  const ORCHESTRATOR_POOL_TEXT = useMemo(() => [
    "Decomposed request into sub-tasks",
    "Coordinated parallel execution",
    "Validated output quality",
    "Routed to text agents",
    "Merged responses",
    "Tokenized and distributed",
    "Ranked and deduplicated",
  ], []);
  const ORCHESTRATOR_POOL_IMAGE = useMemo(() => [
    "Decomposed prompt into style + subject",
    "Routed to image agents",
    "Coordinated parallel generation",
    "Validated resolution and coherence",
    "Upscaled and post-processed",
    "Selected best output",
  ], []);
  const ORCHESTRATOR_POOL_TRAILER = useMemo(() => [
    "Decomposed request into storyboard + video",
    "Coordinated video pipeline",
    "Routed to trailer agents",
    "Validated output quality",
    "Rendered sequence",
    "Synced audio and motion",
    "Exported final cut",
  ], []);

  const submitMessage = async (request: string, forceTrailer: boolean = false, options?: { imageOnly?: boolean }) => {
    const trimmed = request?.trim() ?? "";
    if (!trimmed) return;
    
    // Store latest submitMessage in ref for use in callbacks
    submitMessageRef.current = submitMessage;
    const isImageOnly = options?.imageOnly === true;
    const inputId = forceTrailer ? "nexus-trailer-input" : isImageOnly ? "nexus-imageonly-input" : "nexus-chat-input";
    lastInputIdRef.current = inputId;

    // Si aucun wallet n'est encore connecté, déclenche le même flux
    // que le bouton "Connect Wallet" du Navbar, puis arrête ici.
    // L'utilisateur pourra relancer la requête une fois le wallet connecté,
    // sans perdre le texte saisi (on ne vide pas l'input dans ce cas).
    if (typeof window !== "undefined" && !getSelectedProvider()) {
      window.dispatchEvent(new Event("nexus-connect-wallet"));
      setLlmError("Connect your wallet first, then validate again.");
      return;
    }

    // À partir d'ici on sait que le wallet est prêt : on peut vider le champ
    // (le texte sera restauré automatiquement en cas d'erreur).
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    if (input) input.value = "";
    if (inputId === "nexus-chat-input") setChatDraft("");
    if (inputId === "nexus-imageonly-input") setImageDraft("");
    if (inputId === "nexus-trailer-input") setTrailerDraft("");

    const lower = trimmed.toLowerCase();
    const isTrailerRequest =
      forceTrailer ||
      lower.includes("trailer") ||
      lower.includes("vidéo") ||
      lower.includes("video") ||
      lower.includes("film");

    const isImageRequest =
      lower.includes("image") ||
      lower.includes("dessin") ||
      lower.includes("photo") ||
      lower.includes("illustration") ||
      lower.includes("picture") ||
      lower.includes(" génère ") ||
      lower.includes("affiche") ||
      lower.includes("crée une") ||
      lower.includes("dall") ||
      lower.includes("midjourney");
    const isSmallRequest = trimmed.length < 50;
    const useFewerAgents = isSmallRequest && Math.random() < 0.35;

    type RequestKind = "text" | "image" | "trailer";
    const requestKind: RequestKind = isTrailerRequest ? "trailer" : (isImageOnly || isImageRequest) ? "image" : "text";
    setActiveQuestMode(requestKind);
    setLastQuestMeta({
      input: trimmed,
      mode: requestKind,
      startedAt: Date.now(),
    });
    setExecutionSummary(null);
    lastSummarizedStartRef.current = null;
    const allAgents =
      requestKind === "trailer" ? TRAILER_AGENTS : requestKind === "image" ? IMAGE_AGENTS : TEXT_AGENTS;

    // Sélection des agents déployés
    let aiModels: string[];
    if (requestKind === "text") {
      // Pour toutes les requêtes textuelles :
      // - toujours Claude + ChatGPT
      // - ajout de Venice AI si la demande est "assez osée" (plus longue / complexe)
      const isBoldTextRequest =
        !isSmallRequest &&
        (trimmed.split(/\s+/).length > 20 ||
          /\b(plan|strategy|architecture|pipeline|multi[-\s]?step|orchestrat)/i.test(trimmed));

      aiModels = isBoldTextRequest
        ? ["Claude", "ChatGPT", "Venice AI"]
        : ["Claude", "ChatGPT"];
    } else {
      // Limiter le nombre d'agents non textuels à 3 max :
      // - image : 1 à 3 agents
      // - trailer : 2 à 3 agents
      let agentCount: number;
      if (requestKind === "trailer") {
        agentCount = 2 + Math.floor(Math.random() * 2); // 2–3
      } else {
        // image
        agentCount = 1 + Math.floor(Math.random() * 3); // 1–3
      }
      aiModels = [...allAgents]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(agentCount, allAgents.length));
    }
    const pool =
      requestKind === "trailer"
        ? ORCHESTRATOR_POOL_TRAILER
        : requestKind === "image"
          ? ORCHESTRATOR_POOL_IMAGE
          : ORCHESTRATOR_POOL_TEXT;
    const actionCount = useFewerAgents ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 3);
    const orchestratorActions = [...pool]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(actionCount, pool.length));

    const newEntry = {
      id: Date.now().toString(),
      request: trimmed,
      timestamp: new Date(),
      orchestratorActions,
      aiModels,
    };
    setHistory((prev) => [newEntry, ...prev]);
    setHasValidatedCurrentResponse(true);
    setGenerationStatus([]);
    setGeneratedContent(null);
    setGeneratedVideoUrl(null);
    pendingRequestRef.current = trimmed;
    pendingMessageRef.current = trimmed;
    pendingReferenceImageRef.current = referenceImageUrl;
    setLlmError(null);
    setLlmLoading(true);
    setLlmResponse(null);
    setLlmMode(null);
    setLlmImageUrl(null);

    const idempotencyKey = uuidv4();
    pendingIdempotencyKeyRef.current = idempotencyKey;
    pendingIsTrailerRef.current = isTrailerRequest;
    pendingChatTypeRef.current = isImageOnly ? "image-only" : null;

    const chatApiPath = "/api/chat";
    const chatApiUrl = typeof window !== "undefined" ? `${window.location.origin}${chatApiPath}` : chatApiPath;
    const port = typeof window !== "undefined" ? window.location.port || (window.location.protocol === "https:" ? "443" : "80") : "";
    console.log("[x402-ui] initial fetch url=", chatApiUrl, "port=", port, "Idempotency-Key=", idempotencyKey);

    const chatBody = {
      message: trimmed,
      referenceImageUrl: referenceImageUrl ?? undefined,
      ...(isTrailerRequest ? { isTrailer: true, mode: "trailer" as const } : {}),
      ...(isImageOnly ? { chatType: "image-only" as const } : {}),
    };

    try {
      const res = await fetch(chatApiPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(chatBody),
      });

      console.log("[x402-ui] initial /api/chat status=", res.status);
      if (res.status === 402) {
        let body402: Record<string, unknown> = {};
        try {
          body402 = (await res.json()) as Record<string, unknown>;
        } catch {
          // ignore
        }
        if (body402.x402Mode === "txhash") {
          const payTo = (body402.payTo as string) ?? "";
          const paymentError = (body402.paymentError as string) ?? (body402.paymentStatus === "invalid" && body402.reason ? String(body402.reason) : undefined);
          setTxHashRequirements({
            payTo,
            asset: (body402.asset as string) ?? "",
            amount: (body402.amount as string) ?? "",
            network: (body402.network as string) ?? "base",
            x402Mode: "txhash",
            paymentError: paymentError || (!payTo?.trim() ? "Payment not configured (PAY_TO). Set PAY_TO in Vercel env." : undefined),
          });
          lastTxHashForRetryRef.current = null;
          setHasTxHashForRetry(false);
        } else {
          setTxHashRequirements(null);
        }
        const paymentRequiredHeader =
          res.headers.get("PAYMENT-REQUIRED") ?? res.headers.get("Payment-Required");
        const len = paymentRequiredHeader ? paymentRequiredHeader.length : 0;
        console.log("[x402-ui] PAYMENT-REQUIRED length=", len);
        if (len === 0) {
          console.warn("[x402-ui] PAYMENT-REQUIRED header missing on 402");
        }
        setShowPaymentModal(true);
        setLlmError(null);
        return;
      }

      let data: ChatResponse = {};
      try {
        data = (await res.json()) as ChatResponse;
      } catch {
        data = {};
      }
      const providerError = (data as any)?.error === true;
      const baseMessage =
        (data as any)?.message ?? data?.reply ?? (data as any)?.details ?? null;
      const uiMessage =
        baseMessage === PREMIUM_PACK_TEXT
          ? PAYMENT_CANCELLED_DISPLAY
          : baseMessage ?? PAYMENT_CANCELLED_DISPLAY;

      if (providerError) {
        // Réponse normalisée { error: true, message } depuis le backend (refus contenu / policy)
        if (data?.mode === "trailer") {
          setLlmMode("trailer");
          setGeneratedVideoUrl(null);
        }
        setGeneratedContent(null);
        recordFailureAndSetError(uiMessage);
        setGenerationLoading(false);
        return;
      }

      if (!res.ok) {
        // 5xx = erreur serveur : afficher le message du serveur ou un message générique, pas "premium pack"
        if (res.status >= 500) {
          const serverMsg = typeof baseMessage === "string" && baseMessage.length < 200 ? baseMessage : null;
          recordFailureAndSetError(serverMsg || "Server error. Check configuration or try again later.");
        } else {
          recordFailureAndSetError(PAYMENT_CANCELLED_DISPLAY);
        }
        setLlmMode(data?.mode === "trailer" ? "trailer" : null);
        setGeneratedVideoUrl(null);
        setGeneratedContent(null);
        setGenerationLoading(false);
        return;
      }
      const reply = (data?.reply ?? uiMessage) || "";
      resetFailureCount();
      setLlmResponse(reply);
      setLlmMode(data?.mode === "trailer" ? "trailer" : data?.mode === "chat" ? "chat" : data?.mode === "image" ? "image" : null);
      setLlmImageUrl(data?.mode === "image" && typeof data?.imageUrl === "string" ? data.imageUrl : null);
      setHistory((prev) => prev.map((ent, i) => (i === 0 ? { ...ent, response: reply } : ent)));

      // Only populate the Generation Preview Area for trailer mode.
      // For normal chat, keep the placeholder text ("Generated content will appear here ...").
      if (data?.mode === "trailer") {
        console.log("[submitMessage] trailer response received:", { 
          hasVideoUrl: !!data?.videoUrl, 
          videoUrl: data?.videoUrl,
          reply: data?.reply 
        });
        if (data?.videoUrl) {
          setGeneratedVideoUrl(data.videoUrl);
          setGeneratedContent(data.reply ?? "Video generated successfully.");
        } else {
          console.warn("[submitMessage] trailer mode but no videoUrl in response");
          setGeneratedVideoUrl(null);
          setGeneratedContent(data?.reply ?? "Generation completed.");
        }
        setGenerationLoading(false);
      } else {
        setGenerationLoading(false);
      }
    } catch (e) {
      console.error("[submitMessage] Error:", e);
      const errorMessage = e instanceof Error ? e.message : "Request failed";
      recordFailureAndSetError(errorMessage);
      setGenerationLoading(false);
      setGeneratedVideoUrl(null);
      setGeneratedContent(null);
      // Restore input value on error
      try {
        const input = document.getElementById(inputId) as HTMLInputElement | null;
        if (input && pendingRequestRef.current) {
          input.value = pendingRequestRef.current;
        }
      } catch {
        // ignore
      }
    } finally {
      setLlmLoading(false);
    }
  };

  const getSpeechRecognition = (): SpeechRecognitionCtor => {
    if (typeof window === "undefined") return null;
    const w = window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    return (w.SpeechRecognition || w.webkitSpeechRecognition) as SpeechRecognitionCtor;
  };

  const startVoiceInput = useCallback(() => {
    try {
      setVoiceNotSupported(false);
      const SpeechRecognitionClass = getSpeechRecognition();
      if (!SpeechRecognitionClass) {
        setVoiceNotSupported(true);
        return;
      }
      speechTranscriptRef.current = "";
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: { resultIndex: number; results: Array<{ isFinal: boolean; 0?: { transcript?: string }; length: number }> }) => {
        try {
          let final = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0]?.transcript ?? "";
            if (result.isFinal) final += transcript;
          }
          if (final) speechTranscriptRef.current = (speechTranscriptRef.current + " " + final).trim();
        } catch (err) {
          console.error("[voice] onresult error:", err);
        }
      };

      recognition.onend = () => {
        try {
          setIsListening(false);
          recognitionRef.current = null;
          const transcript = speechTranscriptRef.current.trim();
          if (transcript) {
            const input = document.getElementById("nexus-chat-input") as HTMLInputElement;
            if (input) input.value = transcript;
            // Use ref to avoid dependency issues
            if (submitMessageRef.current) {
              submitMessageRef.current(transcript);
            }
          }
        } catch (err) {
          console.error("[voice] onend error:", err);
          setIsListening(false);
          recognitionRef.current = null;
        }
      };

      recognition.onerror = () => {
        console.error("[voice] recognition error");
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (err) {
      console.error("[voice] start error:", err);
      setVoiceNotSupported(true);
      setIsListening(false);
    }
    // getSpeechRecognition est une lecture stable de window (API SpeechRecognition) ; callback volontairement stable pour éviter re-renders des enfants.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopVoiceInput = useCallback(() => {
    try {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.stop();
        } catch (err) {
          console.error("[voice] stop error:", err);
        }
        recognitionRef.current = null;
      }
      setIsListening(false);
    } catch (err) {
      console.error("[voice] stopVoiceInput error:", err);
      setIsListening(false);
    }
  }, []);

  const handleReferenceFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target?.files?.[0];
      if (!file) return;

      setUploadError(null);

      if (file.size > 10 * 1024 * 1024) {
        setUploadError("File is too large. Maximum size is 10MB.");
        return;
      }

      setUploadingReference(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        let data: { url?: string; error?: string } = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }
        console.log("UPLOAD_JSON:", data);
        if (!res.ok || !data?.url) {
          const msg =
            !data?.url && res.ok
              ? "Upload failed: no URL returned."
              : data?.error || `Upload failed with status ${res.status}`;
          setUploadError(msg);
          return;
        }

        setReferenceImageUrl(data.url as string);
        setReferenceFileName(file.name);
      } catch (e) {
        console.error("[upload] Error:", e);
        const msg = e instanceof Error ? e.message : "Upload failed.";
        setUploadError(msg);
      } finally {
        setUploadingReference(false);
        try {
          if (event.target) {
            event.target.value = "";
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error("[upload] handleReferenceFileChange error:", err);
      setUploadingReference(false);
      setUploadError("Failed to process file.");
    }
  }, []);

  const runGenerationAfterWallet = async (
    message: string,
    referenceImageUrlOverride?: string | null,
    idempotencyKeyOverride?: string | null
  ) => {
    if (!message.trim()) return;
    const refImage = referenceImageUrlOverride ?? referenceImageUrl;
    const idemKey = idempotencyKeyOverride ?? pendingIdempotencyKeyRef.current ?? undefined;
    setGenerationLoading(true);
    setGenerationStatus(["Wallet connected.", "Sending request to Nexus..."]);
    setLlmError(null);
    setLlmResponse(null);
    setLlmMode(null);
    setLlmImageUrl(null);
    setGeneratedContent(null);
    setGeneratedVideoUrl(null);
    try {
      const paidFetch = await createPaidFetchFromConnectedWallet();
      console.debug("[x402-ui] using paidFetch wrapper =", typeof paidFetch);
      const requestBody = {
        message,
        referenceImageUrl: refImage ?? undefined,
        ...(pendingIsTrailerRef.current ? { isTrailer: true, mode: "trailer" as const } : {}),
        ...(pendingChatTypeRef.current === "image-only" ? { chatType: "image-only" as const } : {}),
      };
      const res = await paidFetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idemKey ? { "Idempotency-Key": idemKey } : {}),
        },
        body: JSON.stringify(requestBody),
      });
      let data: ChatResponse = {};
      try {
        data = (await res.json()) as ChatResponse;
      } catch {
        data = {};
      }
      if (res.ok) {
        setGenerationStatus((s) => [...s, "payment received"]);
        setGenerationStatus((s) => [...s, "Response received."]);
      } else {
        setGenerationStatus((s) => [...s, `Error: ${res.status >= 500 ? "Server error" : PREMIUM_PACK_DISPLAY}`]);
      }
      const providerError = (data as any)?.error === true;
      const baseMessage = (data as any)?.message ?? data?.reply ?? (data as any)?.details ?? null;
      const uiMessage = baseMessage === PREMIUM_PACK_TEXT ? PREMIUM_PACK_DISPLAY : (baseMessage ?? PREMIUM_PACK_DISPLAY);
      if (providerError) {
        if (data?.mode === "trailer") {
          setLlmMode("trailer");
          setGeneratedVideoUrl(null);
        }
        setGeneratedContent(null);
        recordFailureAndSetError(uiMessage);
        return;
      }
      if (!res.ok) {
        if (data?.mode === "trailer") {
          setLlmMode("trailer");
          setGeneratedVideoUrl(null);
        }
        setGeneratedContent(null);
        if (res.status >= 500) {
          recordFailureAndSetError(typeof baseMessage === "string" && baseMessage.length < 200 ? baseMessage : "Server error. Try again later.");
        } else {
          recordFailureAndSetError(PREMIUM_PACK_DISPLAY);
        }
        return;
      }
      const reply = data?.reply ?? "";
      resetFailureCount();
      const mode: "trailer" | "image" | "chat" | null =
        data?.mode === "trailer" ? "trailer" :
        data?.mode === "image" ? "image" :
        data?.mode === "chat" ? "chat" :
        null;

      setLlmResponse(reply);
      setLlmMode(mode);
      setLlmImageUrl(mode === "image" && typeof data?.imageUrl === "string" ? data.imageUrl : null);

      // Met à jour la première entrée de l'historique avec la réponse + métadonnées média
      setHistory(prev =>
        prev.map((ent, i) =>
          i === 0
            ? {
                ...ent,
                response: reply,
                mode: mode ?? ent.mode,
                videoUrl: data?.videoUrl ?? ent.videoUrl,
                imageUrl: mode === "image" && typeof data?.imageUrl === "string" ? data.imageUrl : ent.imageUrl,
              }
            : ent,
        ),
      );

      // Only populate the Generation Preview Area for trailer mode.
      // For normal chat, keep the placeholder text ("Generated content will appear here ...").
      if (data?.mode === "trailer") {
        if (data?.videoUrl) {
          setGeneratedVideoUrl(data.videoUrl);
          setGeneratedContent(data.reply ?? "Video generated successfully.");
        } else {
          setGeneratedContent(data?.reply ?? "Generation completed.");
        }
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : "Request failed";
      setGenerationStatus((s) => [...s, `Error: ${err}`]);
      recordFailureAndSetError(err);
      // Réinitialiser les états de génération en cas d'erreur
      setGeneratedVideoUrl(null);
      setGeneratedContent(`Error: ${err}`);
    } finally {
      setGenerationLoading(false);
    }
  };

  /** Get the Ethereum provider for the chosen wallet and trigger it to open (connect request). */
  const openWallet = async (walletId: 'metamask' | 'rabby' | 'walletconnect' | 'coinbase') => {
    setWalletError(null);
    setShowMetaMaskSimulation(false);

    if (typeof window === 'undefined') return;
    const win = window as Window & {
      ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; providers?: unknown[]; isMetaMask?: boolean; isRabby?: boolean; isRabbyWallet?: boolean; isCoinbaseWallet?: boolean };
      coinbaseWalletExtension?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
    };
    const ethereum = win.ethereum;
    if (!ethereum?.request) {
      setWalletError('No wallet extension found. Install MetaMask, Rabby, or Coinbase Wallet.');
      return;
    }

    const providers: unknown[] = Array.isArray(ethereum.providers) ? ethereum.providers : [ethereum];
    type P = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; isMetaMask?: boolean; isRabby?: boolean; isRabbyWallet?: boolean; isCoinbaseWallet?: boolean };
    let provider: P | undefined;

    if (walletId === 'metamask') {
      provider =
        (providers.find(
          (p) => (p as P)?.isMetaMask && !(p as P)?.isRabby && !(p as P)?.isRabbyWallet
        ) as P) ??
        (ethereum.isMetaMask &&
        !(ethereum as P).isRabby &&
        !(ethereum as P).isRabbyWallet
          ? (ethereum as P)
          : undefined);
    } else if (walletId === 'rabby') {
      // 1) EIP-6963 en premier (recommandé par Rabby, fiable multi-wallets) — timeout 800ms
      try {
        const rabbyFrom6963 = await new Promise<P | null>((resolve) => {
          let resolved = false;
          const done = (value: P | null) => {
            if (resolved) return;
            resolved = true;
            window.removeEventListener('eip6963:announceProvider', handler as EventListener);
            resolve(value);
          };
          const handler = (event: Event) => {
            const detail = (event as CustomEvent).detail as {
              info?: { rdns?: string; name?: string };
              provider?: unknown;
            };
            if (detail?.info?.rdns === 'io.rabby' && detail?.provider && typeof (detail.provider as P).request === 'function') {
              done(detail.provider as P);
            }
          };
          window.addEventListener('eip6963:announceProvider', handler as EventListener);
          window.dispatchEvent(new Event('eip6963:requestProvider'));
          setTimeout(() => done(null), 800);
        });
        if (rabbyFrom6963) provider = rabbyFrom6963;
      } catch {
        // ignore
      }

      // 2) Fallback: flags sur window.ethereum / ethereum.providers
      if (!provider) {
        provider =
          (providers.find(
            (p) => (p as P)?.isRabby === true || (p as P)?.isRabbyWallet === true
          ) as P) ??
          ((ethereum as P).isRabby || (ethereum as P).isRabbyWallet ? (ethereum as P) : undefined);
      }
    } else if (walletId === 'coinbase') {
      provider = (providers.find((p) => (p as P)?.isCoinbaseWallet) as P) ?? (ethereum.isCoinbaseWallet ? ethereum as P : win.coinbaseWalletExtension);
    } else {
      provider = ethereum as P;
    }

    if (!provider?.request) {
      const names = { metamask: 'MetaMask', rabby: 'Rabby', coinbase: 'Coinbase Wallet', walletconnect: 'WalletConnect' };
      setWalletError(`${names[walletId]} not detected. Install the extension or use another wallet.`);
      return;
    }

    setSelectedProvider(provider as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> });

    try {
      // Request account access (opens the wallet)
      await provider.request({ method: 'eth_requestAccounts' });

      const pendingMessage = pendingRequestRef.current?.trim();
      if (pendingMessage) {
        pendingRequestRef.current = null;
        runGenerationAfterWallet(
          pendingMessage,
          pendingReferenceImageRef.current,
          pendingIdempotencyKeyRef.current
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection rejected or failed.';
      setWalletError(message);
    }
  };

  // Execution examples organized by category
  const executionExamples = useMemo(() => [
    // Core Execution Examples
    "Produce a complete explanation of quantum computing with examples and a final summary",
    "Design, execute, and validate a Python web scraper",
    "Analyze how smart contracts secure value and return a structured breakdown",
    "Transform a raw idea into a finished technical outcome",
    "Execute a complex request end-to-end and deliver the final result",
    // Multi-Step Orchestration
    "Research, design, and validate a full data pipeline",
    "Analyze market data, generate insights, and summarize findings",
    "Create, test, and optimize an automated trading strategy",
    "Plan, execute, verify, and deliver a complete workflow",
    // Structured Output
    "Generate a step-by-step guide with diagrams and validation",
    "Produce a comparison table with a final recommendation",
    "Return a verified summary with key takeaways",
    // Constrained Execution
    "Deliver an optimized solution under strict performance constraints",
    "Execute this task with minimal cost and maximum accuracy",
    "Generate results optimized for speed, clarity, and efficiency",
    // Transformation & Synthesis
    "Transform these notes into a polished technical document",
    "Convert this concept into an actionable execution plan",
    "Synthesize multiple sources into a single coherent outcome",
    // High-Level Intent
    "Turn this request into a finished outcome",
    "Handle this objective from start to finish",
    "Interpret intent, orchestrate execution, and deliver results",
    // Multimodal / Creative
    "Produce a cinematic AI-generated trailer from concept to final video",
    "Generate a product launch video with visuals, voice, and music",
    "Design a full storyboard and render the final trailer",
  ], []);

  // Display 6 examples at a time, rotate through sets
  const examplesPerSet = 6;
  const totalSets = useMemo(() => Math.ceil(executionExamples.length / examplesPerSet), [executionExamples.length, examplesPerSet]);
  const currentExamples = useMemo(() => {
    return executionExamples.slice(
      currentExampleSet * examplesPerSet,
      (currentExampleSet + 1) * examplesPerSet
    );
  }, [currentExampleSet, examplesPerSet, executionExamples]);

  // Rotate examples every 8 seconds (desktop only)
  useEffect(() => {
    if (isMobile || totalSets <= 1) return;
    const interval = setInterval(() => {
      setCurrentExampleSet((prev) => (prev + 1) % totalSets);
    }, 8000);
    return () => clearInterval(interval);
  }, [totalSets, isMobile]);

  const content = (
    /* workspace layout */
    <div className="enter-nexus-page min-h-screen relative">

      {/* Agent workspace — minimal premium: single column, secondary panels in drawers */}
      <div className="agent-app-shell" ref={heroRef}>
          <div className="w-full max-w-[60rem] mx-auto mb-8 text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-neon-pink">
              [AGENT]
            </h1>
            <p className="text-sm md:text-base text-white/70">
              Autonomous agents. Private by design.
            </p>
          </div>
          {/* Minimal top bar: open secondary panels on demand */}
          <div className="w-full max-w-[60rem] mx-auto flex justify-end gap-0.5 px-0 py-1">
            <button
              type="button"
              onClick={() => setShowExecutionLayersInfo(true)}
              className="w-7 h-7 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-white/50 hover:text-white/90 hover:border-white/30 text-[10px] font-medium"
              aria-label="Information"
              title="Information"
            >
              i
            </button>
            <button
              type="button"
              onClick={() => setOpenPanel(openPanel === "replay" ? null : "replay")}
              className="w-7 h-7 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-white/50 hover:text-white/90 hover:border-white/30"
              aria-label="Demo / Replay"
              title="Demo / Replay"
            >
              ▶
            </button>
            <button
              type="button"
              onClick={() => setOpenPanel(openPanel === "history" ? null : "history")}
              className="w-7 h-7 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-white/50 hover:text-white/90 hover:border-white/30"
              aria-label="History"
              title="History"
            >
              ⎙
            </button>
            <button
              type="button"
              onClick={() => setOpenPanel(openPanel === "orchestration" ? null : "orchestration")}
              className="w-7 h-7 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-white/50 hover:text-white/90 hover:border-white/30"
              aria-label="AI orchestration"
              title="AI orchestration"
            >
              ◇
            </button>
          </div>

          <div className="agent-minimal-center">
                {/* 1. Suggestion cards */}
                {!isMobile && currentExamples.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {currentExamples.slice(0, 6).map((example, i) => (
                      <button key={i} type="button" className="text-left p-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-neon-pink/30 text-white/80 text-xs leading-snug transition-colors w-full" onClick={() => { const el = document.getElementById("nexus-chat-input") as HTMLInputElement; if (el) { el.value = example; el.focus(); } setActiveQuestMode("text"); setChatDraft(example); }}>{example.length > 100 ? example.slice(0, 100) + "…" : example}</button>
                        ))}
                      </div>
                    )}
                {/* 2. Image generation input */}
                <input id="nexus-imageonly-input" type="text" placeholder="Describe the image you want…" className="w-full rounded-lg border border-white/15 bg-white/5 py-2.5 px-3 text-white placeholder-white/40 focus:outline-none focus:border-light-blue/40 text-sm" onFocus={() => { lastInputIdRef.current = "nexus-imageonly-input"; setActiveQuestMode("image"); }} onChange={(e) => setImageDraft(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = (document.getElementById("nexus-imageonly-input") as HTMLInputElement)?.value?.trim(); if (v) submitMessage(v, false, { imageOnly: true }); } }} />
                {/* 3. Video / trailer input */}
                <input id="nexus-trailer-input" type="text" placeholder="Describe the video you want..." className="w-full rounded-lg border border-white/15 bg-white/5 py-2.5 px-3 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/40 text-sm" onFocus={() => { lastInputIdRef.current = "nexus-trailer-input"; setActiveQuestMode("trailer"); }} onChange={(e) => setTrailerDraft(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = (document.getElementById("nexus-trailer-input") as HTMLInputElement)?.value?.trim(); if (v) submitMessage(v, true); } }} />
                {/* 4. Main chat input + actions */}
                <div className="flex gap-1.5">
                  <input id="nexus-chat-input" type="text" placeholder="Type your request here..." className="flex-1 rounded-lg border border-white/15 bg-white/5 py-2.5 px-3 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/40 text-sm" onFocus={() => { lastInputIdRef.current = "nexus-chat-input"; setActiveQuestMode("text"); }} onChange={(e) => setChatDraft(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = (document.getElementById("nexus-chat-input") as HTMLInputElement)?.value?.trim(); if (v) submitMessage(v); } }} />
                  <input ref={referenceInputRef} id="nexus-reference-input" type="file" accept="image/*" className="hidden" onChange={handleReferenceFileChange} />
                  {!isMobile && (<><button type="button" className="w-9 h-9 rounded-lg border border-white/15 bg-white/5 flex items-center justify-center text-white/60 hover:text-white text-sm" onClick={() => referenceInputRef.current?.click()} aria-label="Attach image">📎</button><button type="button" className={`w-9 h-9 rounded-lg border flex items-center justify-center text-sm ${isListening ? "border-red-500/50 text-red-400 bg-red-500/10" : "border-white/15 bg-white/5 text-white/60 hover:text-white"}`} onClick={isListening ? stopVoiceInput : startVoiceInput} aria-label="Voice">🎤</button></>)}
                  <button type="button" className="w-9 h-9 rounded-lg bg-neon-pink/90 hover:bg-neon-pink text-white flex items-center justify-center shrink-0 text-sm" onClick={() => { const id = lastInputIdRef.current ?? "nexus-chat-input"; const el = document.getElementById(id) as HTMLInputElement | null; const v = el?.value?.trim() ?? ""; if (v) { if (id === "nexus-trailer-input") submitMessage(v, true); else if (id === "nexus-imageonly-input") submitMessage(v, false, { imageOnly: true }); else submitMessage(v); } }} aria-label="Send">→</button>
                  </div>

                {/* 5. Text response — bloc principal agrandi (texte / image / vidéo) */}
                <div className="flex flex-col gap-4 min-h-[520px]">
                {/* Text response — minimal header */}
                <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden min-h-[480px]">
                  <div className="border-b border-white/10 px-3 py-1.5">
                    <span className="text-[10px] text-white/50 font-medium uppercase tracking-wider">Response</span>
                  </div>
                  <div className="p-3 min-h-[400px] max-h-[680px] overflow-y-auto">
                    {uploadError && (
                      <div className="mb-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                        {uploadError}
                      </div>
                    )}
                    {generationStatus.length > 0 && (
                      <div className="mb-2 space-y-0.5">
                        <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mb-1">What is happening</p>
                        <ul className="text-sm text-white/80 space-y-1 font-mono">
                          {generationStatus.map((line, i) => (
                            <li key={i} className={line.toLowerCase().startsWith("error") ? "text-red-400" : ""}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(llmLoading || generationLoading) && (
                      <div className="flex flex-col items-center justify-center py-6 text-white/60">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                          className="w-8 h-8 rounded-full border-2 border-neon-pink/50 border-t-neon-pink mb-2"
                        />
                        <p className="text-xs">{generationLoading ? "Generation in progress..." : "Nexus is thinking..."}</p>
                      </div>
                    )}
                    {!llmLoading && !generationLoading && llmError && (
                      <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                        {llmError}
                      </div>
                    )}
                    {!llmLoading && !generationLoading && llmResponse && (
                      <div>
                        {llmMode && (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${llmMode === 'trailer' ? 'bg-neon-pink/20 text-neon-pink' : llmMode === 'image' ? 'bg-light-blue/20 text-light-blue' : 'bg-white/10 text-white/70'}`}>
                            {llmMode === 'trailer' ? 'Trailer' : llmMode === 'image' ? 'Image' : 'Chat'}
                          </span>
                        )}
                        <div className="text-white/90 text-sm md:text-base leading-relaxed">
                          {renderFormattedResponse(llmResponse)}
                        </div>
                      </div>
                    )}
                    {!llmLoading && !generationLoading && !llmError && !llmResponse && generationStatus.length === 0 && (
                    <div className="text-center p-4 text-white/40">
                      <svg className="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-xs">
                        Text responses will appear here
                      </p>
                      <p className="text-[10px] mt-1 text-white/30">
                          Connect wallet, then validate; status and reply appear here. Images and videos will also appear in this panel.
                      </p>
                    </div>
                    )}
                  </div>
                </div>

                {(llmResponse || llmError || executionSummary) && (
                    <ExecutionSummary data={executionSummary} />
                )}
                </div>
          </div>

          {/* Slide drawers for secondary panels */}
          <AnimatePresence>
            {openPanel && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="agent-drawer-overlay" onClick={() => setOpenPanel(null)} aria-hidden="true" />
                <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="agent-drawer-panel">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-white/90">
                      {openPanel === "replay" && "Demo / Replay"}
                      {openPanel === "history" && "Execution history"}
                      {openPanel === "orchestration" && "AI orchestration"}
                    </span>
                    <button type="button" className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/70 hover:text-white" onClick={() => setOpenPanel(null)} aria-label="Close">×</button>
                  </div>
                  {openPanel === "replay" && (
                    <div className="space-y-4">
                      <DemoReplay onRunReplay={runDemoReplay} running={replayRunning} demoResult={demoResult} videoUrl={demoVideoUrl} executionMode={executionMode} />
                      {(monitorRunning || monitorEvents.length > 0) && <ExecutionMonitor phase={currentPhase} progress={progress} events={monitorEvents} running={monitorRunning} executionMode={executionMode} />}
                    </div>
                  )}
                  {openPanel === "history" && (
                    <div className="space-y-4 overflow-y-auto text-sm text-white/70">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-neon-pink">
                          Execution History
                        </h3>
                        {history.length > 0 && historyUnlocked && (
                          <div className="flex items-center gap-2">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={downloadHistoryCsv}
                              className="px-3 py-1.5 rounded-lg bg-light-blue/20 border border-light-blue/40 text-light-blue text-xs font-semibold hover:bg-light-blue/30 transition-all duration-300 flex items-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              CSV
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setHistory([])}
                              className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-semibold hover:bg-red-500/25 transition-all duration-300"
                            >
                              Clear
                            </motion.button>
                          </div>
                        )}
                      </div>

                      {!historyUnlocked ? (
                        <p className="text-xs text-white/60">
                          Enter your 6-digit history code in the card just below the chat to unlock Execution History.
                        </p>
                      ) : history.length === 0 ? (
                        <p className="text-xs text-white/60">
                          No execution history yet. Run a Quest and results will appear here.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {history.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] text-light-blue font-semibold uppercase tracking-wide">
                                  QUEST
                                </span>
                                <span className="text-[10px] text-white/40 font-mono">
                                  {entry.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="text-xs text-white/80 line-clamp-2">
                                {entry.request}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {openPanel === "orchestration" && (
                    <div className="space-y-4 overflow-y-auto text-sm text-white/70">
                      <p>AI agents orchestration is in the section at the bottom of the page. Close this panel and scroll down.</p>
                      <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-white/90 hover:bg-white/10" onClick={() => { setOpenPanel(null); executionBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }}>Scroll to orchestration</button>
                  </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Zone basse : Incoming capabilities + Execution plan sous le chat + code d'historique */}
          <footer className="agent-bottom border-t border-white/10 mt-8" ref={executionBottomRef}>
                <div className="flex flex-col min-h-0 overflow-auto pr-2 border-r border-white/10">
                {/* Incoming capabilities */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="mb-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 min-h-[260px]"
                >
                  <h3 className="text-sm font-semibold text-neon-pink mb-1">Incoming capabilities</h3>
                  <p className="text-xs text-white/60 mb-3">
                    These features are currently in preparation and will expand the Nexus execution layer in upcoming releases.
                  </p>
                  <ul className="space-y-2 text-xs text-white/70">
                    <li>
                      <span className="font-semibold text-light-blue">Parallel Execution</span>
                      <span className="block text-white/60">
                        Run multiple execution lanes simultaneously for complex Quests and multi-step workflows.
                      </span>
                    </li>
                    <li>
                      <span className="font-semibold text-light-blue">Advanced Verification</span>
                      <span className="block text-white/60">
                        Additional validation layers applied to orchestrated steps and generated outputs.
                      </span>
                    </li>
                    <li>
                      <span className="font-semibold text-light-blue">Larger File Processing</span>
                      <span className="block text-white/60">
                        Work with larger documents, datasets, and complex artifacts during execution.
                      </span>
                    </li>
                    <li>
                      <span className="font-semibold text-light-blue">Professional Export</span>
                      <span className="block text-white/60">
                        Generate structured outputs and export execution results to PDF, DOCX, or PPTX formats.
                      </span>
                    </li>
                    <li>
                      <span className="font-semibold text-light-blue">Priority Execution</span>
                      <span className="block text-white/60">
                        Access priority execution lanes during periods of high system demand.
                      </span>
                    </li>
                  </ul>
                </motion.div>

                {/* Execution plan visible sous le chat */}
                <div className="mb-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-4">
                  <ExecutionPlanPreview
                    input={currentPreviewInput}
                    mode={activeQuestMode}
                    executionMode={executionMode}
                  />
                </div>

                {/* History access code - setup (first visit) or unlock */}
                {historyCodeMounted && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 1.35 }}
                    className="mb-4 rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-4 flex flex-wrap items-center justify-center gap-3"
                  >
                    {!hasCodeSet ? (
                      <>
                        <span className="text-sm text-white/70 w-full text-center">Set your 6-digit code to protect history. Anonymous, stored only in this session.</span>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Code"
                          value={historyCodeInput}
                          onChange={(e) => {
                            setHistoryCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setHistoryCodeError(null);
                          }}
                          className="w-24 px-2 py-1.5 rounded-lg border border-white/20 bg-black/50 text-white text-center text-base tracking-[0.35em] font-mono focus:outline-none focus:border-neon-pink/50 focus:ring-1 focus:ring-neon-pink/30"
                        />
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Confirm"
                          value={historyCodeConfirm}
                          onChange={(e) => {
                            setHistoryCodeConfirm(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setHistoryCodeError(null);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && handleHistoryCodeSetup()}
                          className="w-24 px-2 py-1.5 rounded-lg border border-white/20 bg-black/50 text-white text-center text-base tracking-[0.35em] font-mono focus:outline-none focus:border-neon-pink/50 focus:ring-1 focus:ring-neon-pink/30"
                        />
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleHistoryCodeSetup}
                          className="px-4 py-2 rounded-lg bg-neon-pink/30 border border-neon-pink/50 text-neon-pink text-sm font-semibold hover:bg-neon-pink/40 transition-all"
                        >
                          Set code
                        </motion.button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-white/70">Enter your 6-digit code to view history</span>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="••••••"
                          value={historyCodeInput}
                          onChange={(e) => {
                            setHistoryCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setHistoryCodeError(null);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && handleHistoryCodeSubmit()}
                          className="w-28 px-3 py-2 rounded-lg border border-white/20 bg-black/50 text-white text-center text-lg tracking-[0.5em] font-mono focus:outline-none focus:border-neon-pink/50 focus:ring-1 focus:ring-neon-pink/30"
                        />
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleHistoryCodeSubmit}
                          className="px-4 py-2 rounded-lg bg-neon-pink/30 border border-neon-pink/50 text-neon-pink text-sm font-semibold hover:bg-neon-pink/40 transition-all"
                        >
                          Unlock
                        </motion.button>
                        {historyUnlocked && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setHistoryUnlocked(false)}
                            className="px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white/80 text-sm font-semibold hover:bg-white/20 transition-all flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Lock
                          </motion.button>
                        )}
                      </>
                    )}
                    {historyCodeError && (
                      <span className="text-xs text-red-400 w-full text-center">{historyCodeError}</span>
                    )}
                  </motion.div>
                )}

                </div>

                <div className="flex flex-col min-h-[900px] overflow-auto pl-2">
                {/* AI Agents Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 1.45 }}
                  whileHover={{ scale: 1.02 }}
                  className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm overflow-hidden relative flex flex-col min-h-[600px]"
                  style={{
                    boxShadow: '0 0 20px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(163, 216, 244, 0.05)',
                  }}
                >
                  {!historyUnlocked && (
                    <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/40 pointer-events-none rounded-2xl" style={{ filter: "blur(4px)" }} />
                  )}
                  {/* AI Agents Header */}
                  <div className="flex items-center justify-between p-4 border-b border-white/10 relative z-20">
                    <h3
                      className="text-sm md:text-base font-semibold text-neon-pink"
                      title="Agent-level orchestration trace for each Quest"
                    >
                      AI Agents Orchestration
                    </h3>
                    <span className="text-xs text-white/40 font-mono">
                      {history.length > 0 ? `${history.length} mission${history.length > 1 ? 's' : ''}` : '0 missions'}
                    </span>
                  </div>

                  {/* AI Agents Content - when locked, do not render real content (prevents copy-paste) */}
                  <div className="enter-history-scroll max-h-[500px] overflow-y-auto p-4 relative z-20">
                    {history.length === 0 ? (
                      <div className="text-center py-8 text-white/40">
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <p className="text-sm">No agents deployed yet</p>
                        <p className="text-xs mt-1 text-white/30">AI agents will appear here as Nexus orchestrates your requests</p>
                      </div>
                    ) : !historyUnlocked ? (
                      <div className="text-center py-12 text-white/50 select-none">
                        <svg className="w-14 h-14 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <p className="text-sm font-medium">Content locked</p>
                        <p className="text-xs mt-1 text-white/40">Enter your 6-digit code above to view AI agents orchestration</p>
                        <div className="mt-6 flex justify-center gap-2">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-3 w-16 rounded bg-white/20" aria-hidden="true" />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {history.map((entry) => (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            whileHover={{ scale: 1.03 }}
                            className="p-5 rounded-xl border border-white/5 bg-black/20 hover:border-light-blue/20 transition-all duration-300"
                          >
                            {/* Mission Header */}
                            <div className="mb-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs text-light-blue font-semibold">MISSION</span>
                                <span className="text-xs text-white/40">
                                  {entry.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="text-sm text-white/80 font-medium">{entry.request}</p>
                            </div>

                            {/* AI Agents Grid */}
                            {entry.aiModels.length > 0 && (
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-xs text-neon-pink font-semibold">AGENTS DEPLOYED</span>
                                  <span className="text-xs text-white/40">
                                    ({entry.aiModels.length} agent{entry.aiModels.length > 1 ? 's' : ''})
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {entry.aiModels.map((model, idx) => (
                                    <motion.div
                                      key={idx}
                                      initial={{ opacity: 0, scale: 0.9 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ duration: 0.3, delay: idx * 0.1 }}
                                      whileHover={{ scale: 1.1 }}
                                      className="p-3 rounded-lg border border-light-blue/20 bg-gradient-to-br from-light-blue/10 to-neon-pink/10 backdrop-blur-sm hover:border-light-blue/40 transition-all duration-300"
                                      style={{
                                        boxShadow: '0 0 15px rgba(163, 216, 244, 0.1)',
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-light-blue animate-pulse"></div>
                                        <span className="text-xs text-white/90 font-semibold">{model}</span>
                                      </div>
                                      <p className="text-xs text-white/50 mt-1.5">Active</p>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Orchestration Status */}
                            {entry.orchestratorActions.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-white/5">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs text-cyan-300 font-semibold">ORCHESTRATION STATUS</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full bg-black/40 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: '100%' }}
                                      transition={{ duration: 1, delay: 0.5 }}
                                      className="h-full bg-gradient-to-r from-light-blue via-neon-pink to-light-blue rounded-full"
                                    />
                                  </div>
                                  <span className="text-xs text-light-blue font-semibold">Complete</span>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
                </div>
          </footer>
      </div>

                {/* Payment confirmation overlay */}
                <CenteredOverlay
                  isOpen={showPaymentModal && !showMetaMaskSimulation}
                  title="x402 Payment"
                  titleCentered={!!txHashRequirements}
                  message="Base network required. Click Pay to debit 0.05 USDC."
                  primaryLabel={
                    txHashRequirements
                      ? paymentConfirmingExhausted
                        ? "Check again"
                        : hasTxHashForRetry
                          ? "Retry"
                          : "Pay"
                      : "Pay"
                  }
                  primaryDisabled={
                    txHashPaymentPending ||
                    (!!txHashRequirements && !hasTxHashForRetry && !paymentConfirmingExhausted && !walletReadiness?.ready) ||
                    (!!txHashRequirements && !txHashRequirements.payTo?.trim())
                  }
                  footer={
                    txHashRequirements
                      ? (llmLoading && hasTxHashForRetry) || txHashPaymentPending
                        ? (
                            <div className="w-full relative h-2 flex items-center">
                              <div className="absolute inset-x-0 h-0.5 rounded-full bg-neon-pink/50" />
                              <motion.div
                                className="absolute h-2 w-16 -ml-8 rounded-full bg-neon-pink/90 pointer-events-none"
                                style={{
                                  boxShadow: "0 0 20px rgba(255, 123, 198, 0.9), 0 0 40px rgba(255, 123, 198, 0.5)",
                                }}
                                animate={{ left: ["0%", "100%", "0%"] }}
                                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                              />
                            </div>
                          )
                        : paymentConfirmingExhausted || (hasTxHashForRetry && txHashRequirements.paymentError)
                          ? (onPrimary: () => void) => (
                              <div className="flex justify-center">
                                <button
                                  type="button"
                                  onClick={onPrimary}
                                  className="px-6 py-2.5 rounded-xl bg-neon-pink/80 hover:bg-neon-pink text-white text-sm font-semibold transition-colors"
                                >
                                  Retry
                                </button>
                              </div>
                            )
                          : undefined
                      : undefined
                  }
                  autoHideMs={0}
                  onPrimary={async () => {
                    const chatApiPath = "/api/chat";
                    const message = pendingMessageRef.current ?? "";
                    const refImage = pendingReferenceImageRef.current ?? null;
                    const idemKey = pendingIdempotencyKeyRef.current ?? undefined;

                    const BACKOFF_MS = [1000, 1500, 2000, 2500, 3000, 3000, 3000, 3000];
                    const MAX_ATTEMPTS = 8;

                    const doFetchWithTxHash = async (txHash: string): Promise<boolean> => {
                      setLlmError(null);
                      setPaymentConfirmingExhausted(false);
                      let lastWasPending = false;
                      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                        const body = {
                          message,
                          referenceImageUrl: refImage ?? undefined,
                          ...(pendingIsTrailerRef.current ? { isTrailer: true, mode: "trailer" as const } : {}),
                        };
                        const res = await fetch(chatApiPath, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "X-PAYMENT": JSON.stringify({ txHash }),
                            ...(idemKey ? { "Idempotency-Key": idemKey } : {}),
                          },
                          body: JSON.stringify(body),
                        });
                        let data: ChatResponse = {};
                        try {
                          data = (await res.json()) as ChatResponse;
                        } catch {
                          data = {};
                        }
                        if (res.status === 402) {
                          const body402 = (data as Record<string, unknown>) || {};
                          const paymentStatus = body402.paymentStatus as string | undefined;
                          const reason = body402.reason as string | undefined;

                          if (paymentStatus === "pending") {
                            if (attempt < MAX_ATTEMPTS - 1) {
                              lastWasPending = true;
                              setTxHashRequirements((prev) => (prev ? { ...prev, paymentError: undefined } : null));
                              const delay = BACKOFF_MS[attempt] ?? 3000;
                              await new Promise((r) => setTimeout(r, delay));
                              continue;
                            }
                            setPaymentConfirmingExhausted(true);
                            setTxHashRequirements((prev) => (prev ? { ...prev, paymentError: undefined } : null));
                            return false;
                          }

                          lastWasPending = false;
                          const userMessage =
                            paymentStatus === "invalid"
                              ? reason === "wrong_amount"
                                ? "Wrong amount."
                                : reason === "already_used"
                                  ? "Payment already used."
                                  : "Invalid payment."
                              : paymentStatus === "failed"
                                ? "Transaction failed."
                                : "Payment declined.";
                          setTxHashRequirements((prev) => (prev ? { ...prev, paymentError: userMessage } : null));
                          recordFailureAndSetError(userMessage);
                          return false;
                        }
                        if (!res.ok) {
                          const baseMsg = (data as any)?.message ?? (data as any)?.reply ?? (data as any)?.details;
                          if (res.status >= 500) {
                            recordFailureAndSetError(typeof baseMsg === "string" && baseMsg.length < 200 ? baseMsg : "Server error. Try again later.");
                          } else {
                            recordFailureAndSetError(PREMIUM_PACK_DISPLAY);
                          }
                          return false;
                        }
                        clearPendingPayment();
                        setShowPaymentModal(false);
                        setTxHashRequirements(null);
                        lastTxHashForRetryRef.current = null;
                        setHasTxHashForRetry(false);
                        setPaymentConfirmingExhausted(false);
                        const providerError = (data as any)?.error === true;
                        const baseMessage =
                          (data as any)?.message ?? data?.reply ?? (data as any)?.details ?? null;
                        const uiMessage =
                          baseMessage === PREMIUM_PACK_TEXT
                            ? PAYMENT_CANCELLED_DISPLAY
                            : baseMessage ?? PAYMENT_CANCELLED_DISPLAY;

                        if (providerError) {
                          if (data?.mode === "trailer") {
                            setLlmMode("trailer");
                            setGeneratedVideoUrl(null);
                          }
                          setGeneratedContent(null);
                          recordFailureAndSetError(uiMessage);
                          setGenerationLoading(false);
                          return false;
                        }

                        const reply = (data?.reply ?? uiMessage) || "";
                        resetFailureCount();
                        setLlmResponse(reply);
                        setLlmMode(data?.mode === "trailer" ? "trailer" : data?.mode === "chat" ? "chat" : data?.mode === "image" ? "image" : null);
                        setLlmImageUrl(data?.mode === "image" && typeof data?.imageUrl === "string" ? data.imageUrl : null);
                        setHistory((prev) => prev.map((ent, i) => (i === 0 ? { ...ent, response: reply } : ent)));
                        
                        // Only populate the Generation Preview Area for trailer mode.
                        // For normal chat, keep the placeholder text ("Generated content will appear here ...").
                        if (data?.mode === "trailer") {
                          console.log("[x402-ui] txhash trailer response received:", { 
                            hasVideoUrl: !!data?.videoUrl, 
                            videoUrl: data?.videoUrl,
                            reply: data?.reply 
                          });
                          if (data?.videoUrl) {
                            setGeneratedVideoUrl(data.videoUrl);
                            setGeneratedContent(data.reply ?? "Video generated successfully.");
                          } else {
                            console.warn("[x402-ui] txhash trailer mode but no videoUrl in response");
                            setGeneratedVideoUrl(null);
                            setGeneratedContent(data?.reply ?? "Generation completed. (No video URL received)");
                          }
                          setGenerationLoading(false);
                        } else {
                          setGenerationLoading(false);
                        }
                        
                        console.log("[x402-ui] txhash payment accepted, chat resumed");
                        return true;
                      }
                      return false;
                    };

                    if (txHashRequirements) {
                      try {
                        setLlmLoading(true);
                        setLlmError(null);
                        let txHash: string | null = lastTxHashForRetryRef.current;
                        if (!txHash) {
                          const provider = getSelectedProvider();
                          if (!provider?.request) {
                            setLlmLoading(false);
                            setShowPaymentModal(false);
                            setShowMetaMaskSimulation(true);
                            setLlmError(null);
                            return;
                          }
                          // Warm-up: first RPC call can be cold in dev
                          let warm = await warmUpProvider(provider as Parameters<typeof warmUpProvider>[0]);
                          if (!warm.ok) {
                            await new Promise((r) => setTimeout(r, 500));
                            warm = await warmUpProvider(provider as Parameters<typeof warmUpProvider>[0]);
                          }
                          setTxHashPaymentPending(true);
                          let result = await sendUsdcTransferAndGetTxHash({
                            provider: provider as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
                            payTo: txHashRequirements.payTo ?? "",
                          });
                          if (!result.ok && result.code === "rpc_unavailable") {
                            await new Promise((r) => setTimeout(r, 800));
                            result = await sendUsdcTransferAndGetTxHash({
                              provider: provider as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> },
                              payTo: txHashRequirements.payTo ?? "",
                            });
                          }
                          setTxHashPaymentPending(false);
                          if (!result.ok) {
                            const code = result.code as string | number | undefined;
                            if (code === "user_rejected" || code === 4001) recordFailureAndSetError("Payment cancelled.");
                            else if (code === "wrong_network") recordFailureAndSetError("Switch to Base network in your wallet.");
                            else if (code === "wallet_not_ready") {
                              recordFailureAndSetError("Connect your wallet first.");
                              setShowMetaMaskSimulation(true);
                            } else if (code === "rpc_unavailable") recordFailureAndSetError("Network busy. Try again.");
                            else if (code === "insufficient_funds") recordFailureAndSetError("Insufficient USDC on Base.");
                            else if (code === "insufficient_gas") recordFailureAndSetError("Add some ETH on Base for gas.");
                            else recordFailureAndSetError(result.error);
                            return;
                          }
                          txHash = result.txHash;
                          lastTxHashForRetryRef.current = txHash;
                          setHasTxHashForRetry(true);
                          savePendingPayment({
                            txHash,
                            requestBody: {
                              message,
                              referenceImageUrl: refImage,
                              isTrailer: pendingIsTrailerRef.current || undefined,
                              mode: pendingIsTrailerRef.current ? ("trailer" as const) : undefined,
                            },
                            idemKey,
                            payTo: txHashRequirements.payTo,
                          });
                        }
                        await doFetchWithTxHash(txHash);
                      } catch (e) {
                        setTxHashPaymentPending(false);
                        recordFailureAndSetError(e instanceof Error ? e.message : "Payment failed.");
                      } finally {
                        setLlmLoading(false);
                      }
                      return;
                    }

                    console.log("[x402-ui] retrying paidFetch to", chatApiPath);
                    try {
                      setLlmLoading(true);
                      setLlmError(null);
                      const paidFetch = await createPaidFetchFromConnectedWallet();
                      console.debug("[x402-ui] using paidFetch wrapper =", typeof paidFetch);

                      const requestBody = {
                        message,
                        referenceImageUrl: refImage ?? undefined,
                        ...(pendingIsTrailerRef.current ? { isTrailer: true, mode: "trailer" as const } : {}),
                      };
                      const res = await paidFetch(chatApiPath, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...(idemKey ? { "Idempotency-Key": idemKey } : {}),
                        },
                        body: JSON.stringify(requestBody),
                      });

                      console.log("[x402-ui] paid status=", res.status);
                      if (res.status === 402) {
                        recordFailureAndSetError(
                          "Payment not accepted. Check Base network and USDC balance."
                        );
                        return;
                      }

                      let data: ChatResponse = {};
                      try {
                        data = (await res.json()) as ChatResponse;
                      } catch {
                        data = {};
                      }

                      const providerError = (data as any)?.error === true;
                      const baseMessage =
                        (data as any)?.message ?? data?.reply ?? (data as any)?.details ?? null;
                      const uiMessage =
                        baseMessage === PREMIUM_PACK_TEXT
                          ? PAYMENT_CANCELLED_DISPLAY
                          : baseMessage ?? PAYMENT_CANCELLED_DISPLAY;

                      if (providerError) {
                        if (data?.mode === "trailer") {
                          setLlmMode("trailer");
                          setGeneratedVideoUrl(null);
                        }
                        setGeneratedContent(null);
                        setGenerationLoading(false);
                        recordFailureAndSetError(uiMessage);
                        return;
                      }

                      if (!res.ok) {
                        if (data?.mode === "trailer") {
                          setLlmMode("trailer");
                          setGeneratedVideoUrl(null);
                        }
                        setGeneratedContent(null);
                        setGenerationLoading(false);
                        if (res.status >= 500) {
                          const baseMsg = (data as any)?.message ?? (data as any)?.reply ?? (data as any)?.details;
                          recordFailureAndSetError(typeof baseMsg === "string" && baseMsg.length < 200 ? baseMsg : "Server error. Try again later.");
                        } else {
                          recordFailureAndSetError(PAYMENT_CANCELLED_DISPLAY);
                        }
                        return;
                      }

                      setShowPaymentModal(false);
                      const reply = (data?.reply ?? uiMessage) || "";
                      resetFailureCount();
                      setLlmResponse(reply);
                      setLlmMode(
                        data?.mode === "trailer"
                          ? "trailer"
                          : data?.mode === "chat"
                          ? "chat"
                          : data?.mode === "image"
                          ? "image"
                          : null
                      );
                      setLlmImageUrl(data?.mode === "image" && typeof data?.imageUrl === "string" ? data.imageUrl : null);
                      setHistory((prev) =>
                        prev.map((ent, i) => (i === 0 ? { ...ent, response: reply } : ent))
                      );

                      // Only populate the Generation Preview Area for trailer mode.
                      // For normal chat, keep the placeholder text ("Generated content will appear here ...").
                      if (data?.mode === "trailer") {
                        console.log("[x402-ui] trailer response received:", { 
                          hasVideoUrl: !!data?.videoUrl, 
                          videoUrl: data?.videoUrl,
                          reply: data?.reply,
                          fullData: data 
                        });
                        if (data?.videoUrl) {
                          setGeneratedVideoUrl(data.videoUrl);
                          setGeneratedContent(data.reply ?? "Video generated successfully.");
                        } else {
                          console.warn("[x402-ui] trailer mode but no videoUrl in response");
                          setGeneratedVideoUrl(null);
                          setGeneratedContent(data?.reply ?? "Generation completed. (No video URL received)");
                        }
                        setGenerationLoading(false);
                      } else {
                        setGenerationLoading(false);
                      }
                    } catch (err: unknown) {
                      const e = err as { code?: number | string; message?: string; stack?: string };
                      const msg = e?.message ?? String(err);
                      console.error("[x402-ui] payment error err.code=", e?.code, "err.message=", e?.message, "err.stack=", e?.stack);
                      if (msg === "NO_WALLET_PROVIDER") {
                        recordFailureAndSetError("No wallet detected. Install MetaMask or Rabby.");
                        setShowMetaMaskSimulation(true);
                      } else if (msg === "WALLET_NOT_CONNECTED") {
                        recordFailureAndSetError("Connect your wallet first.");
                        setShowMetaMaskSimulation(true);
                      } else if (msg === "WRONG_NETWORK") {
                        recordFailureAndSetError("Switch to Base network in your wallet.");
                      } else if (
                        (e && (e.code === 4001 || e.code === "4001")) ||
                        msg.toLowerCase().includes("user rejected")
                      ) {
                        recordFailureAndSetError("Payment cancelled.");
                      } else if (
                        msg.toLowerCase().includes("insufficient funds for gas") ||
                        msg.toLowerCase().includes("insufficient funds")
                      ) {
                        recordFailureAndSetError("Insufficient funds. Add some ETH on Base for gas.");
                      } else if (msg.toLowerCase().includes("invalid params") || msg.toLowerCase().includes("eth_signtypeddata")) {
                        recordFailureAndSetError("Signature rejected. Check MetaMask/Rabby and try again.");
                      } else {
                        recordFailureAndSetError("Payment failed. Check the console.");
                      }
                      // Réinitialiser les états de génération en cas d'erreur
                      setGeneratedVideoUrl(null);
                      setGeneratedContent(null);
                    } finally {
                      setLlmLoading(false);
                    }
                  }}
                  onClose={() => {
                    setShowPaymentModal(false);
                    setTxHashRequirements(null);
                    lastTxHashForRetryRef.current = null;
                    setHasTxHashForRetry(false);
                    setTxHashPaymentPending(false);
                    setPaymentConfirmingExhausted(false);
                    setWalletReadiness(null);
                  }}
                >
                  {txHashRequirements ? (
                    <div className="space-y-2">
                      {paymentConfirmingExhausted ? (
                        <>
                          <p className="text-white/90 text-sm leading-snug">
                            Payment is still confirming on-chain.
                          </p>
                          {lastTxHashForRetryRef.current && (
                            <a
                              href={`https://basescan.org/tx/${lastTxHashForRetryRef.current}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neon-pink/90 hover:text-neon-pink text-sm underline"
                            >
                              View transaction
                            </a>
                          )}
                        </>
                      ) : (
                        <>
                          {!walletReadiness?.ready && !hasTxHashForRetry && (
                            <p className="text-amber-300/90 text-sm mb-2">
                              {walletReadiness?.code === "wrong_network"
                                ? "Switch to Base network in your wallet."
                                : "Connect your wallet and switch to Base."}
                            </p>
                          )}
                          <p className="text-white/90 text-sm leading-snug">
                            {txHashPaymentPending
                              ? "Payment in progress… Confirm in your wallet."
                              : llmLoading && hasTxHashForRetry
                                ? "Payment confirming…"
                                : "0.05 USDC (Base). On-chain payment, no third-party account."}
                          </p>
                          {txHashRequirements.paymentError && (
                            <p className="text-red-400 text-sm">{txHashRequirements.paymentError}</p>
                          )}
                        </>
                      )}
                    </div>
                  ) : null}
                </CenteredOverlay>

                {/* Nexus wallet selector simulation (mini window) */}
                <AnimatePresence>
                  {showMetaMaskSimulation && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                      onClick={() => {
                        setShowMetaMaskSimulation(false);
                        if (txHashRequirements) setShowPaymentModal(true);
                      }}
                    >
                      <motion.div
                        initial={{ scale: 0.92, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.92, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm rounded-2xl overflow-hidden border border-neon-pink/30 bg-black/95 backdrop-blur-md shadow-2xl"
                        style={{
                          boxShadow: "0 0 40px rgba(255, 123, 198, 0.2), 0 0 20px rgba(163, 216, 244, 0.1)",
                        }}
                      >
                        {/* Nexus header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/50">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-pink/30 to-light-blue/30 border border-neon-pink/40 flex items-center justify-center">
                              <svg className="w-5 h-5 text-neon-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <span className="text-white font-bold text-lg tracking-tight">Nexus</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowMetaMaskSimulation(false);
                              if (txHashRequirements) setShowPaymentModal(true);
                            }}
                            className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            aria-label="Close"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        </div>

                        {/* Subtitle */}
                        <div className="px-5 pt-4 pb-3">
                          <p className="text-white/70 text-sm">Choose a wallet to pay (Base, 0.05 USDC)</p>
                        </div>

                        {/* Wallet list */}
                        <div className="px-4 pb-5 space-y-2">
                          {/* MetaMask */}
                          <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => openWallet('metamask')}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-neon-pink/30 transition-all duration-200"
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-white/10">
                              <Image src="/wallet/metamask.png" alt="MetaMask" width={40} height={40} className="object-contain" />
                            </div>
                            <div className="text-left flex-1">
                              <p className="text-white font-semibold">MetaMask</p>
                              <p className="text-white/50 text-xs">Popular wallet</p>
                            </div>
                            <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                          </motion.button>

                          {/* Rabby */}
                          <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => openWallet('rabby')}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-neon-pink/30 transition-all duration-200"
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-white/10">
                              <Image src="/wallet/rabby.png" alt="Rabby" width={40} height={40} className="object-contain" />
                            </div>
                            <div className="text-left flex-1">
                              <p className="text-white font-semibold">Rabby</p>
                              <p className="text-white/50 text-xs">Multi-chain wallet</p>
                            </div>
                            <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                          </motion.button>

                          {/* WalletConnect - uses default injected provider to open wallet */}
                          <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => openWallet('walletconnect')}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-neon-pink/30 transition-all duration-200"
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-white/10">
                              <Image src="/wallet/walletconnect.png" alt="WalletConnect" width={40} height={40} className="object-contain" />
                            </div>
                            <div className="text-left flex-1">
                              <p className="text-white font-semibold">WalletConnect</p>
                              <p className="text-white/50 text-xs">Scan to connect</p>
                            </div>
                            <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                          </motion.button>

                          {/* Coinbase Wallet */}
                          <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => openWallet('coinbase')}
                            className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-neon-pink/30 transition-all duration-200"
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-white/10">
                              <Image src="/wallet/coinbase.webp" alt="Coinbase Wallet" width={40} height={40} className="object-contain" />
                            </div>
                            <div className="text-left flex-1">
                              <p className="text-white font-semibold">Coinbase Wallet</p>
                              <p className="text-white/50 text-xs">Easy to use</p>
                            </div>
                            <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                          </motion.button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Wallet error toast */}
                <AnimatePresence>
                  {walletError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[105] px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm max-w-md text-center shadow-lg"
                    >
                      {walletError}
                      <button type="button" onClick={() => setWalletError(null)} className="ml-2 underline">Dismiss</button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Listening overlay */}
                <AnimatePresence>
                  {isListening && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                      onClick={stopVoiceInput}
                    >
                      <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0.9 }}
                        className="px-8 py-6 rounded-2xl bg-black/80 border border-neon-pink/40 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="w-14 h-14 rounded-full bg-red-500/30 border-2 border-red-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
                          <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          </svg>
                        </div>
                        <p className="text-white font-semibold text-lg">Listening...</p>
                        <p className="text-white/60 text-sm mt-1">Click here or anywhere to stop</p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Voice not supported message */}
                <AnimatePresence>
                  {voiceNotSupported && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-sm shadow-lg max-w-md text-center"
                    >
                      Voice input is not supported in this browser.
                      <button type="button" onClick={() => setVoiceNotSupported(false)} className="ml-3 underline font-medium">Dismiss</button>
                    </motion.div>
                  )}
                </AnimatePresence>

      {/* Modale Information — Execution Layers (ouverte par le bouton "i") */}
      <AnimatePresence>
        {showExecutionLayersInfo && (
          <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowExecutionLayersInfo(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Information sur les couches d’exécution"
          >
                    <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-black/90 border border-white/20 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">Execution Layers</h2>
                <button
                  type="button"
                  onClick={() => setShowExecutionLayersInfo(false)}
                  className="w-8 h-8 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Fermer"
                >
                  ×
                        </button>
                      </div>
              <div className="overflow-y-auto p-4 space-y-6">
                <div className="rounded-xl border border-neon-pink/20 bg-black/40 p-4">
                  <span className="text-neon-pink font-mono text-xs">01</span>
                  <h3 className="text-base font-bold text-light-blue mt-1">Execution Interface</h3>
                  <p className="text-neon-pink/80 text-xs font-medium mt-1">Intent → Structured Action</p>
                  <p className="text-white/70 text-sm mt-2 leading-relaxed">The primary interface where requests enter the Living Brain. User intent is interpreted, decomposed, and transformed into an execution plan.</p>
                  <ul className="text-white/60 text-sm mt-2 space-y-1">
                    <li>• No prompts to manage</li>
                    <li>• No tools to select</li>
                    <li>• No context to stitch together</li>
                        </ul>
                  <p className="text-light-blue/80 text-sm font-medium mt-3">Execution begins the moment intent is expressed.</p>
                              </div>
                <div className="rounded-xl border border-light-blue/20 bg-black/40 p-4">
                  <span className="text-light-blue font-mono text-xs">02</span>
                  <h3 className="text-base font-bold text-neon-pink mt-1">Orchestration Layer</h3>
                  <p className="text-light-blue/80 text-xs font-medium mt-1">Coordinated Intelligence</p>
                  <p className="text-white/70 text-sm mt-2 leading-relaxed">The orchestration core of Nexus. It plans, sequences, and coordinates specialized capabilities into a single coherent flow.</p>
                  <ul className="text-white/60 text-sm mt-2 space-y-1">
                    <li>• Task decomposition</li>
                    <li>• Dependency management</li>
                    <li>• Parallel execution when possible</li>
                    <li>• Continuous validation</li>
                </ul>
                  <p className="text-neon-pink/80 text-sm font-medium mt-3">All intelligence remains specialized. All execution remains unified.</p>
                </div>
                <div className="rounded-xl border border-neon-pink/20 bg-black/40 p-4">
                  <span className="text-neon-pink font-mono text-xs">03</span>
                  <h3 className="text-base font-bold text-light-blue mt-1">Economic Execution Layer (x402)</h3>
                  <p className="text-neon-pink/80 text-xs font-medium mt-1">Execution-Native Settlement</p>
                  <p className="text-white/70 text-sm mt-2 leading-relaxed">Every unit of work is economically native to execution. Costs are bound to execution itself, not to access, accounts, or subscriptions.</p>
                  <ul className="text-white/60 text-sm mt-2 space-y-1">
                    <li>• Deterministic pricing per execution</li>
                    <li>• Single settlement per Quest</li>
                    <li>• No manual billing</li>
                    <li>• No idle costs</li>
                </ul>
                  <p className="text-light-blue/80 text-sm font-medium mt-3">x402 ensures the system can scale sustainably without human coordination.</p>
                </div>
                <div className="rounded-xl border border-light-blue/20 bg-black/40 p-4">
                  <span className="text-light-blue font-mono text-xs">04</span>
                  <h3 className="text-base font-bold text-neon-pink mt-1">Execution Observability</h3>
                  <p className="text-light-blue/80 text-xs font-medium mt-1">Transparency Without Complexity</p>
                  <p className="text-white/70 text-sm mt-2 leading-relaxed">Execution is never a black box. Nexus exposes the full execution lifecycle without exposing internal complexity.</p>
                  <ul className="text-white/60 text-sm mt-2 space-y-1">
                    <li>• Execution flow visibility</li>
                    <li>• Cost boundaries per Quest</li>
                    <li>• Validation and completion signals</li>
                </ul>
                  <p className="text-neon-pink/80 text-sm font-medium mt-3">What happens is visible. How it happens stays orchestrated.</p>
                </div>
              </div>
              </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      {content}
      <AILogosMarquee />
    </>
  );
}
