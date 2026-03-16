"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  setSelectedProvider,
  getSelectedProvider,
  getLastWalletKey,
  setLastWalletKey,
  rehydrateProvider,
  clearWalletConnection,
  type LastWalletKey,
} from "@/lib/walletProviderStore";

type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};
type ProviderWithFlags = EIP1193Provider & {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isRabbyWallet?: boolean;
};

function getWalletProviders(): {
  list: { name: string; provider: EIP1193Provider; key: LastWalletKey }[];
  single: EIP1193Provider | null;
  singleKey: LastWalletKey | null;
} {
  if (typeof window === "undefined") return { list: [], single: null, singleKey: null };
  const win = window as Window & { ethereum?: ProviderWithFlags & { providers?: ProviderWithFlags[] } };
  const ethereum = win.ethereum;
  if (!ethereum?.request) return { list: [], single: null, singleKey: null };

  const providers = Array.isArray(ethereum.providers) ? ethereum.providers : [ethereum];
  const metamask = providers.find(
    (p) => (p as ProviderWithFlags)?.isMetaMask && !(p as ProviderWithFlags)?.isRabby && !(p as ProviderWithFlags)?.isRabbyWallet
  ) as ProviderWithFlags | undefined;
  const rabby = providers.find(
    (p) => (p as ProviderWithFlags)?.isRabby === true || (p as ProviderWithFlags)?.isRabbyWallet === true
  ) as ProviderWithFlags | undefined;

  const list: { name: string; provider: EIP1193Provider; key: LastWalletKey }[] = [];
  if (metamask?.request) list.push({ name: "MetaMask", provider: metamask, key: "metamask" });
  if (rabby?.request) list.push({ name: "Rabby", provider: rabby, key: "rabby" });

  if (list.length >= 2) return { list, single: null, singleKey: null };
  if (list.length === 1) return { list, single: list[0].provider, singleKey: list[0].key };
  return { list: [], single: ethereum as EIP1193Provider, singleKey: "default" };
}

function getWalletKey(provider: EIP1193Provider): LastWalletKey {
  const p = provider as ProviderWithFlags;
  if (p?.isRabby === true || p?.isRabbyWallet === true) return "rabby";
  if (p?.isMetaMask === true) return "metamask";
  return "default";
}

const NAV_ITEMS = [
  { href: "/", label: "Agent" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/mixer", label: "Mixer" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/ai-companion", label: "AI Companion" },
] as const;

export function DappNav() {
  const pathname = usePathname();
  const normalized = pathname?.replace(/\/$/, "") || "";
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showWalletMessage, setShowWalletMessage] = useState<"error" | "success" | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const connectWithProvider = useCallback(async (provider: EIP1193Provider) => {
    setShowWalletMessage(null);
    setShowWalletPicker(false);
    setSelectedProvider(provider);
    try {
      const result = await provider.request({ method: "eth_requestAccounts" });
      let address: string | null = null;
      if (Array.isArray(result) && typeof result[0] === "string") address = result[0] as string;
      else if (typeof (result as { [key: string]: unknown })?.[0] === "string") address = (result as { [key: string]: unknown })[0] as string;
      if (address) {
        setWalletAddress(address);
        setLastWalletKey(getWalletKey(provider));
      }
      setShowWalletMessage("success");
      setTimeout(() => setShowWalletMessage(null), 2500);
    } catch {
      setShowWalletMessage("error");
      setTimeout(() => setShowWalletMessage(null), 3000);
    }
  }, []);

  const handleConnectWallet = useCallback(() => {
    setShowWalletMessage(null);
    if (typeof window === "undefined") return;
    const { list, single } = getWalletProviders();
    if (single) {
      connectWithProvider(single);
      return;
    }
    if (list.length >= 2) {
      setShowWalletPicker(true);
      return;
    }
    if (list.length === 1) {
      connectWithProvider(list[0].provider);
      return;
    }
    const ethereum = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
    if (!ethereum?.request) {
      setShowWalletMessage("error");
      setTimeout(() => setShowWalletMessage(null), 3000);
      return;
    }
    connectWithProvider(ethereum);
  }, [connectWithProvider]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    rehydrateProvider();
    const provider = getSelectedProvider();
    if (!provider?.request) return;
    provider
      .request({ method: "eth_accounts" })
      .then((res) => {
        const accounts = Array.isArray(res) ? (res as string[]) : [];
        const address = typeof accounts[0] === "string" ? accounts[0] : null;
        if (address) setWalletAddress(address);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const provider = getSelectedProvider();
    const p = provider as (EIP1193Provider & { on?: (event: string, cb: (...args: unknown[]) => void) => void }) | null;
    if (!p?.on) return;
    const onAccounts = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? accounts : [];
      if (list.length === 0) {
        clearWalletConnection();
        setWalletAddress(null);
      } else {
        const addr = typeof list[0] === "string" ? list[0] : null;
        if (addr) setWalletAddress(addr);
      }
    };
    const onDisconnect = () => {
      clearWalletConnection();
      setWalletAddress(null);
    };
    p.on("accountsChanged", onAccounts);
    p.on("disconnect", onDisconnect);
    return () => {
      const rem = (p as { removeListener?: (e: string, cb: (...args: unknown[]) => void) => void }).removeListener;
      if (typeof rem === "function") {
        rem.call(p, "accountsChanged", onAccounts);
        rem.call(p, "disconnect", onDisconnect);
      }
    };
  }, [walletAddress]);

  useEffect(() => {
    if (!showWalletPicker) return;
    const close = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowWalletPicker(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showWalletPicker]);

  // When Agent (or other page) requests wallet connection, open same flow as nav button
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onRequest = () => handleConnectWallet();
    window.addEventListener("nexus-connect-wallet", onRequest);
    return () => window.removeEventListener("nexus-connect-wallet", onRequest);
  }, [handleConnectWallet]);

  return (
    <nav
      className="fixed top-0 left-0 right-0 w-full border-b border-white/10 bg-black/90 backdrop-blur-md z-50"
      role="navigation"
      aria-label="dApp navigation"
    >
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6">
        <div className="relative flex items-center justify-between h-12">
          {/* Left: branding + Nexus logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-light-blue font-mono font-semibold text-xs sm:text-sm tracking-wide hover:text-neon-pink transition-colors shrink-0"
          >
            <span className="flex items-center gap-1.5">
              <span className="relative inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center">
                <Image
                  src="/Nexus%20Logo/Nexuslogo.png"
                  alt="Nexus"
                  fill
                  className="object-contain"
                  priority
                />
              </span>
              <span className="text-white/90">Nexus AI BETA</span>
            </span>
          </Link>

          {/* Center: tabs */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-0.5 sm:gap-1">
            {NAV_ITEMS.map(({ href, label }) => {
              const isActive = href === "/" ? pathname === "/" || pathname === "" : normalized === href;
              return (
                <Link key={href} href={href} className="relative">
                  <span
                    className={`
                      block px-2.5 py-1.5 sm:px-3 rounded-md text-xs font-medium transition-colors
                      ${isActive ? "text-white/90" : "text-white/70 hover:text-white/90"}
                    `}
                  >
                    {label}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="dapp-nav-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-pink rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right: Connect Wallet */}
          <div className="flex items-center shrink-0" ref={pickerRef}>
            <button
              type="button"
              onClick={handleConnectWallet}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-neon-pink/40 text-neon-pink text-xs font-semibold hover:border-neon-pink/60 hover:bg-neon-pink/10 transition-colors"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path d="M21 12V7H5a2 2 0 01-2-2 2 2 0 012-2h14v4" />
                <path d="M3 5v14a2 2 0 002 2h16v-5" />
                <path d="M18 12a2 2 0 000 4 2 2 0 000-4z" />
              </svg>
              <span className="whitespace-nowrap">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Connect Wallet"}
              </span>
            </button>
            <AnimatePresence>
              {showWalletPicker && (() => {
                const { list } = getWalletProviders();
                if (list.length < 2) return null;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full right-0 mt-1 py-1 rounded-lg border border-white/20 bg-black/95 backdrop-blur-md shadow-xl z-50 min-w-[140px]"
                  >
                    <p className="px-2.5 py-1 text-white/60 text-xs font-medium">Choose wallet</p>
                    {list.map(({ name, provider }) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => connectWithProvider(provider)}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-neon-pink hover:bg-white/10"
                      >
                        {name}
                      </button>
                    ))}
                  </motion.div>
                );
              })()}
            </AnimatePresence>
            <AnimatePresence>
              {showWalletMessage !== null && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`absolute top-full right-0 mt-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap z-50 ${
                    showWalletMessage === "success" ? "bg-green-500/20 border border-green-500/40 text-green-400" : "bg-red-500/20 border border-red-500/40 text-red-400"
                  }`}
                >
                  {showWalletMessage === "success" ? "Connected" : "No wallet or rejected"}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </nav>
  );
}
