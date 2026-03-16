"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  getMixerBalances,
  sendMixerTransfer,
  parseMixerAmount,
  isValidBaseAddress,
  type MixerBalances,
  type EIP1193Provider,
} from "@/lib/mixerWallet";
import { getSelectedProvider } from "@/lib/walletProviderStore";
import { getWalletReadiness } from "@/lib/x402/txHashWalletPayment";

const TOKENS = ["ETH", "USDC", "USDT"] as const;
const DELAYS = ["Instant", "1h", "8h", "24h"] as const;

export default function MixerPage() {
  const [mixerToken, setMixerToken] = useState<"ETH" | "USDC" | "USDT">("ETH");
  const [mixerAmount, setMixerAmount] = useState("");
  const [mixerRecipient, setMixerRecipient] = useState("");
  const [mixerDelay, setMixerDelay] = useState<"Instant" | "1h" | "8h" | "24h">("Instant");
  const [mixerBalances, setMixerBalances] = useState<MixerBalances | null>(null);
  const [mixerBalanceLoading, setMixerBalanceLoading] = useState(false);
  const [mixerError, setMixerError] = useState<string | null>(null);
  const [mixerSending, setMixerSending] = useState(false);
  const [mixerTxHash, setMixerTxHash] = useState<string | null>(null);
  const [mixerWalletAddress, setMixerWalletAddress] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: -9999, y: -9999 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const provider = getSelectedProvider() as EIP1193Provider | null;
    if (!provider) {
      setMixerBalances(null);
      setMixerWalletAddress(null);
      setMixerBalanceLoading(false);
      return;
    }
    let cancelled = false;
    setMixerBalanceLoading(true);
    getWalletReadiness(provider)
      .then((readiness) => {
        if (cancelled || !readiness.ready || !readiness.address) {
          setMixerWalletAddress(readiness.address ?? null);
          setMixerBalances(null);
          setMixerBalanceLoading(false);
          return;
        }
        return getMixerBalances(provider, readiness.address).then((result) => {
          if (cancelled) return;
          setMixerBalanceLoading(false);
          setMixerWalletAddress(readiness.address ?? null);
          if (result.ok) {
            setMixerBalances(result.balances);
            setMixerError(null);
          } else {
            setMixerBalances(null);
            setMixerError(result.error);
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setMixerBalanceLoading(false);
          setMixerBalances(null);
          setMixerWalletAddress(null);
        }
      });
    const interval = setInterval(() => {
      getWalletReadiness(provider).then((r) => {
        if (r.ready && r.address) getMixerBalances(provider, r.address).then((res) => {
          if (res.ok) setMixerBalances(res.balances);
        });
      });
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const handleSend = async () => {
    const provider = getSelectedProvider() as EIP1193Provider | null;
    if (!provider || !mixerWalletAddress) {
      window.dispatchEvent(new Event("nexus-connect-wallet"));
      return;
    }
    const toTrim = mixerRecipient.trim();
    if (!isValidBaseAddress(toTrim)) {
      setMixerError("Invalid recipient address (use 0x + 40 hex characters).");
      return;
    }
    const decimals = mixerToken === "ETH" ? 18 : 6;
    const amountRaw = parseMixerAmount(mixerAmount, decimals as 6 | 18);
    if (amountRaw === null || amountRaw <= 0n) {
      setMixerError("Enter a valid amount.");
      return;
    }
    setMixerError(null);
    setMixerSending(true);
    const result = await sendMixerTransfer(provider, mixerWalletAddress as `0x${string}`, {
      token: mixerToken,
      amountRaw,
      to: toTrim as `0x${string}`,
    });
    setMixerSending(false);
    if (result.ok) {
      setMixerTxHash(result.txHash);
      setMixerAmount("");
      const res = await getMixerBalances(provider, mixerWalletAddress);
      if (res.ok) setMixerBalances(res.balances);
    } else {
      setMixerError(result.error);
    }
  };

  const balanceStr = mixerBalanceLoading ? "…" : mixerBalances
    ? (mixerToken === "ETH" ? mixerBalances.eth : mixerToken === "USDC" ? mixerBalances.usdc : mixerBalances.usdt)
    : "—";

  return (
    <div className="w-full min-h-screen p-4 sm:p-5 lg:p-6 relative">
      <div className="w-full max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-center text-neon-pink">
            [MIXER]
          </h1>
          <p className="text-sm md:text-base text-white/70 max-w-2xl mx-auto text-center">
            Anonymous transfers. Break the on-chain link between sender and receiver.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative lg:col-span-2 p-4 md:p-5 rounded-2xl border border-neon-pink/20 bg-black/50 backdrop-blur-sm"
            style={{ boxShadow: "0 0 30px rgba(255, 123, 198, 0.2)" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-neon-pink">ANONYMOUS TRANSFER</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-neon-pink/40 bg-neon-pink/10 text-neon-pink tracking-wide uppercase">
                Coming soon
              </span>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-white/60 mb-3">NETWORK</label>
              <div className="flex gap-3">
                <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="flex-1 px-4 py-3 rounded-lg bg-neon-pink/20 border-2 border-neon-pink/60 text-neon-pink font-semibold text-sm flex items-center justify-center gap-2">
                  <span className="w-3 h-3 rounded bg-light-blue" /> Base
                </motion.button>
                <button type="button" disabled className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-white/40 cursor-not-allowed text-sm">
                  Solana (coming soon)
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-white/60 mb-3">TOKEN</label>
              <div className="flex gap-3">
                {TOKENS.map((token) => (
                  <motion.button
                    key={token}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setMixerToken(token)}
                    className={mixerToken === token ? "flex-1 px-4 py-3 rounded-lg font-semibold text-sm bg-neon-pink/20 border-2 border-neon-pink/60 text-neon-pink" : "flex-1 px-4 py-3 rounded-lg font-semibold text-sm border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20"}
                  >
                    {token}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-white/60 mb-3">AMOUNT</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={mixerAmount}
                onChange={(e) => setMixerAmount(e.target.value.replace(/[^0-9.,]/g, "").replace(/,/g, "."))}
                className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/50"
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-white/50">Balance: {balanceStr} {mixerToken}</span>
                <button type="button" onClick={() => mixerBalances && setMixerAmount(mixerToken === "ETH" ? mixerBalances.eth : mixerToken === "USDC" ? mixerBalances.usdc : mixerBalances.usdt)}
                  className="px-3 py-1 rounded text-xs bg-light-blue/20 border border-light-blue/40 text-light-blue">MAX {mixerToken}</button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-white/60 mb-3">RECIPIENT ADDRESS</label>
              <input
                type="text"
                placeholder="0x..."
                value={mixerRecipient}
                onChange={(e) => setMixerRecipient(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-white/10 bg-black/30 text-white placeholder-white/40 focus:outline-none focus:border-neon-pink/50 font-mono text-sm"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm text-white/60 mb-3">DELAY (UI only)</label>
              <div className="flex gap-3">
                {DELAYS.map((d) => (
                  <motion.button key={d} type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setMixerDelay(d)}
                    className={mixerDelay === d ? "flex-1 px-4 py-3 rounded-lg font-semibold text-sm bg-neon-pink/20 border-2 border-neon-pink/60 text-neon-pink" : "flex-1 px-4 py-3 rounded-lg font-semibold text-sm border border-white/10 text-white/60 hover:text-white/80"}>
                    {d}
                  </motion.button>
                ))}
              </div>
            </div>

            {mixerError && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{mixerError}</div>}
            {mixerTxHash && (
              <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-sm">
                Sent. Tx: <a href={`https://basescan.org/tx/${mixerTxHash}`} target="_blank" rel="noreferrer" className="underline">{mixerTxHash.slice(0, 10)}…</a>
              </div>
            )}

            <div className="mb-6 p-4 rounded-lg bg-black/30 border border-white/10">
              <div className="flex justify-between"><span className="text-sm text-white/60">Network Fee</span><span className="text-sm font-semibold text-light-blue">~0.001 ETH (gas)</span></div>
            </div>

            {mixerWalletAddress && (
              <div className="mb-4 flex items-center justify-center gap-2 text-sm text-white/70">
                Connected: <span className="font-mono text-light-blue">{mixerWalletAddress.slice(0, 6)}…{mixerWalletAddress.slice(-4)}</span>
              </div>
            )}

            <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={mixerSending} onClick={handleSend}
              className="w-full px-6 py-4 rounded-lg bg-gradient-to-r from-neon-pink/40 via-light-blue/40 to-neon-pink/40 border border-neon-pink/60 text-white font-bold text-lg disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ boxShadow: "0 0 30px rgba(255, 123, 198, 0.4)" }}>
              {!mixerWalletAddress ? "CONNECT WALLET" : mixerSending ? "SENDING…" : "SEND"}
            </motion.button>
          </motion.div>

          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="p-6 rounded-2xl border border-light-blue/20 bg-black/40 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-light-blue mb-4">Privacy guaranteed</h3>
              <ul className="space-y-2 text-sm text-white/70 list-none pl-0">
                <li>Funds are processed through our privacy layer.</li>
                <li>On-chain trail is broken between sender and recipient.</li>
                <li>No logs, no tracking, complete anonymity.</li>
              </ul>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="p-6 rounded-2xl border border-neon-pink/20 bg-black/40 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-neon-pink mb-4 text-center">HOW IT WORKS</h3>
              <div className="space-y-4">
                {[{ step: "Send", desc: "Enter amount and recipient address" }, { step: "Privacy", desc: "Our system breaks the on-chain connection" }, { step: "Receive", desc: "Recipient gets funds with no traceable link" }].map((item, index) => (
                  <div key={index} className="grid grid-cols-[32px,1fr] gap-3 items-start">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-neon-pink/40 to-light-blue/40 border border-neon-pink/60 text-white font-bold text-sm">{index + 1}</div>
                    <div>
                      <h4 className="text-base font-semibold text-light-blue mb-0.5">{item.step}</h4>
                      <p className="text-sm text-white/60">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
            <p className="text-center text-xs text-white/40">Use responsibly. Privacy is a right, not a tool for illegal activity.</p>
          </div>
        </div>
      </div>

      {/* Full-page preview overlay (below navbar) */}
      <div
        className="fixed inset-x-0 top-12 bottom-0 z-40 flex items-center justify-center"
        style={{
          background: `radial-gradient(
            circle at ${cursorPos.x}px ${cursorPos.y}px,
            rgba(255,123,198,0.22) 0,
            rgba(255,123,198,0.15) 90px,
            rgba(0,0,0,0.78) 170px
          )`,
          backdropFilter: "blur(6px)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md px-8 py-8 rounded-2xl border border-neon-pink/40 bg-black/90 text-center shadow-[0_0_40px_rgba(255,123,198,0.4)]"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-neon-pink mb-3">
            Nexus Mixer
          </h2>
          <div className="relative w-24 h-24 mx-auto mb-4 rounded-2xl overflow-hidden border border-neon-pink/60 bg-black/80">
            <Image
              src="/DAPP%20LOGO/mixer.png"
              alt="Nexus Mixer"
              fill
              className="object-contain"
              priority
            />
          </div>
          <p className="text-sm text-white/70 mb-3">Available at launch.</p>
          <p className="text-sm text-white/60 mb-3">
            The Nexus Mixer is currently in preparation and will be released with the launch phase.
          </p>
          <p className="text-sm text-white/60 mb-4">
            This interface is not yet active inside the private dApp.
          </p>
          <div className="flex items-center justify-center gap-1 text-neon-pink/80 text-xs">
            <span className="w-2 h-2 rounded-full bg-neon-pink animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-neon-pink/70 animate-[pulse_1.4s_ease-in-out_infinite_0.2s]" />
            <span className="w-2 h-2 rounded-full bg-neon-pink/50 animate-[pulse_1.4s_ease-in-out_infinite_0.4s]" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
