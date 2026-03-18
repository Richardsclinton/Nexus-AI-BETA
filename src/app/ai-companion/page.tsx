"use client";

import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";

export default function AICompanionPage() {
  // Identity
  const [companionName, setCompanionName] = useState("BitNex");
  const [role, setRole] = useState("Nexus AI Companion");
  const [description, setDescription] = useState(
    "BitNex is the default Nexus AI Companion. It acts as an intelligent execution assistant inside the Nexus ecosystem. BitNex helps structure objectives, plan workflows, coordinate AI tools and guide execution across tasks and projects."
  );
  const [personality, setPersonality] = useState("Calm, precise, execution-focused.");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are BitNex, the Nexus AI Companion. You help users reason about their objectives, orchestrate Nexus tools, and keep their data private by design."
  );

  // Engine
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState("0.3");

  // Capabilities (placeholders)
  const [capabilities, setCapabilities] = useState({
    tools: true,
    wallet: false,
    execute: true,
    marketplace: false,
  });
  const [showPreview, setShowPreview] = useState(true);

  return (
    <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-[1920px] mx-auto">
        {/* Header with BitNex logo */}
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-light-blue via-neon-pink to-light-blue bg-clip-text text-transparent">
              [AI COMPANION / BITNEX]
            </h1>
            <p className="text-sm md:text-base text-white/70 max-w-2xl mx-auto">
              Configure and manage your AI Companion integration. Connect endpoints, set credentials, and control access.
            </p>
          </div>
          <div className="relative w-28 h-10 md:w-36 md:h-12 rounded-lg overflow-hidden border border-neon-pink/40 bg-black/60 flex items-center justify-center">
            <Image
              src="/BitNex/Bitnex.png"
              alt="BitNex"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* SECTION 1 — Companion Identity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-2 p-6 rounded-2xl border border-neon-pink/20 bg-black/40 backdrop-blur-sm"
          >
            <h2 className="text-lg font-semibold text-neon-pink mb-4">Companion identity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/60 mb-1">Companion name</label>
                <input
                  type="text"
                  value={companionName}
                  onChange={(e) => setCompanionName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Role</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/50 transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-white/60 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/50 transition-all resize-none"
                />
                <p className="mt-2 text-[11px] text-white/50">
                  The Companion identity defines how your AI behaves inside the Nexus workspace. Future updates will allow deeper customization including alternative BitNex personalities, specialized assistants and personalized execution profiles.
                </p>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Personality</label>
                <textarea
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/50 transition-all resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">System prompt / instructions</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/50 transition-all resize-none"
                />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="p-6 rounded-2xl border border-light-blue/20 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
          >
            <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden border border-neon-pink/50 bg-black/80">
              <Image
                src="/BitNex/Bitnex.png"
                alt="BitNex Avatar"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="text-center space-y-1 max-w-xs">
              <p className="text-[11px] font-semibold text-neon-pink">Default Companion</p>
              <p className="text-xs text-white/70">BitNex AI</p>
              <p className="text-xs text-white/60">
                This is the default BitNex AI companion created by Nexus AI. In future releases users will be able to personalize their BitNex companion and choose alternative AI personalities.
              </p>
            </div>
          </motion.div>
        </div>

        {/* SECTION 2 & 3 — AI Engine + Capabilities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* AI Engine */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative p-6 rounded-2xl border border-neon-pink/20 bg-black/40 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-neon-pink">AI engine</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/40">
                  Available
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-neon-pink/40 bg-neon-pink/10 text-neon-pink tracking-wide uppercase">
                Preview
              </span>
            </div>
            <p className="text-sm text-white/60 mb-4">
              The AI Engine defines which AI model powers your companion. Nexus supports hybrid AI infrastructure allowing integration with external model providers or custom endpoints.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/60 mb-1">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Endpoint URL</label>
                <input
                  type="url"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. gemini-3-flash"
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Temperature (optional)</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/50 transition-all"
                />
              </div>
              <p className="text-[11px] text-white/50">
                The selected AI engine powers reasoning, execution planning and conversational interaction with your BitNex companion.
              </p>
              <button
                type="button"
                className="px-4 py-2.5 rounded-lg bg-neon-pink/20 border border-neon-pink/40 text-neon-pink font-semibold text-sm hover:bg-neon-pink/30 transition-all"
              >
                Save configuration
              </button>
            </div>
          </motion.div>

          {/* Capabilities (placeholder toggles) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="p-6 rounded-2xl border border-light-blue/20 bg-black/40 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-light-blue">Capabilities</h2>
            </div>
            <p className="text-sm text-white/60 mb-4">
              Capabilities define what the AI Companion is allowed to interact with inside the Nexus ecosystem. These permissions control access to tools, wallets and execution modules.
            </p>
            <div className="space-y-3">
              <CapabilityToggle
                label="Access Nexus tools"
                enabled={capabilities.tools}
                onToggle={() => setCapabilities((c) => ({ ...c, tools: !c.tools }))}
              />
              <CapabilityToggle
                label="Access user wallet"
                enabled={capabilities.wallet}
                onToggle={() => setCapabilities((c) => ({ ...c, wallet: !c.wallet }))}
              />
              <CapabilityToggle
                label="Execute requests"
                enabled={capabilities.execute}
                onToggle={() => setCapabilities((c) => ({ ...c, execute: !c.execute }))}
              />
              <CapabilityToggle
                label="Marketplace interaction"
                enabled={capabilities.marketplace}
                onToggle={() => setCapabilities((c) => ({ ...c, marketplace: !c.marketplace }))}
              />
            </div>
            <p className="mt-3 text-[11px] text-white/50">
              Additional permissions and advanced execution controls will be introduced in future updates.
            </p>
          </motion.div>
        </div>

        {/* SECTION 4 — Extensions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="p-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-white/80">Companion extensions</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
              Soon
            </span>
          </div>
          <p className="text-sm text-white/60 mb-2">
            Companion extensions allow the AI Companion to connect with additional tools, AI models, data providers and execution modules. Through the Nexus execution marketplace, developers will be able to publish integrations that extend the companion&apos;s capabilities.
          </p>
          <p className="text-sm text-white/60">
            This modular architecture allows BitNex companions to evolve over time as new AI services and execution tools are added to the Nexus infrastructure.
          </p>
        </motion.div>

        {/* Info panel — Companion Architecture */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-2 mb-4 p-5 rounded-2xl border border-white/10 bg-black/40"
        >
          <h3 className="text-sm font-semibold text-white mb-2">Companion Architecture</h3>
          <p className="text-sm text-white/70 mb-3">
            The Nexus AI Companion is built around a privacy first and execution oriented architecture. Interactions remain private while the companion focuses on transforming user intent into structured execution.
          </p>
          <ul className="text-sm text-white/70 space-y-1 list-disc list-inside">
            <li>Natural conversational interaction</li>
            <li>AI assisted workflow planning</li>
            <li>Multi step execution orchestration</li>
            <li>Hybrid local and external AI infrastructure</li>
            <li>Zero retention privacy architecture</li>
          </ul>
        </motion.div>

        {/* Privacy note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mb-4 p-4 rounded-xl border border-light-blue/30 bg-black/40 text-xs md:text-sm text-white/70"
        >
          Privacy by design. Nexus AI Companion interactions follow a zero retention architecture. Prompts are processed during execution and are not permanently stored on Nexus servers.
        </motion.div>

        {/* Future BitNex companions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mb-4 p-4 rounded-xl border border-white/10 bg-black/40 text-xs md:text-sm text-white/70"
        >
          <h3 className="text-sm font-semibold text-white mb-1">Future BitNex companions</h3>
          <p className="mb-1">
            In future releases users will be able to choose their own BitNex companion. Each BitNex will represent a personalized AI presence with different behaviors, capabilities and execution specializations.
          </p>
          <p className="text-white/50">Choose your BitNex coming soon.</p>
        </motion.div>

      </div>

      {/* Full-page preview overlay (below navbar) */}
      {showPreview && (
        <div className="fixed inset-x-0 top-12 bottom-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-md px-8 py-8 rounded-2xl border border-neon-pink/40 bg-black/90 text-center shadow-[0_0_40px_rgba(255,123,198,0.4)]"
          >
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="absolute right-4 top-4 text-white/60 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-xl md:text-2xl font-semibold text-neon-pink mb-2">
              BitNex AI Companion
            </h2>
            <div className="relative w-24 h-24 mx-auto mb-4 rounded-2xl overflow-hidden border border-neon-pink/60 bg-black/80">
              <Image
                src="/BitNex/Bitnex.png"
                alt="BitNex"
                fill
                className="object-contain"
                priority
              />
            </div>
            <p className="text-sm text-white/70 mb-4">
              Available at the launch of the BitNex beta.
            </p>
            <p className="text-sm text-white/60 mb-3">
              Currently in preparation and will be released soon in beta.
            </p>
            <p className="text-sm text-white/60 mb-6">
              The Nexus AI Companion is under active development. New capabilities, integrations and execution features will progressively appear in this interface as the ecosystem evolves.
            </p>
            <div className="flex items-center justify-center gap-1 text-neon-pink/80 text-xs">
              <span className="w-2 h-2 rounded-full bg-neon-pink animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-neon-pink/70 animate-[pulse_1.4s_ease-in-out_infinite_0.2s]" />
              <span className="w-2 h-2 rounded-full bg-neon-pink/50 animate-[pulse_1.4s_ease-in-out_infinite_0.4s]" />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function CapabilityToggle({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 text-sm text-white/80">
      <span>{label}</span>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full border ${
          enabled ? "bg-neon-pink/60 border-neon-pink" : "bg-black/60 border-white/30"
        } transition-colors`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
