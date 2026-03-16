/**
 * Global store for the EIP-1193 provider chosen by the user (MetaMask, Rabby, etc.).
 * Used so Navbar and enter page connect with the same provider, and paid fetch uses it for x402.
 * Persists choice in localStorage so connection survives reload until user disconnects in the wallet.
 */
export type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type ProviderWithFlags = EIP1193Provider & { isMetaMask?: boolean; isRabby?: boolean; isRabbyWallet?: boolean };

let selectedProvider: EIP1193Provider | null = null;

export function getSelectedProvider(): EIP1193Provider | null {
  return selectedProvider;
}

export function setSelectedProvider(provider: EIP1193Provider | null): void {
  selectedProvider = provider;
}

const NEXUS_LAST_WALLET_KEY = "nexus_last_wallet";
export type LastWalletKey = "metamask" | "rabby" | "default";

export function getLastWalletKey(): LastWalletKey | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(NEXUS_LAST_WALLET_KEY);
  if (v === "metamask" || v === "rabby" || v === "default") return v;
  return null;
}

export function setLastWalletKey(key: LastWalletKey): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NEXUS_LAST_WALLET_KEY, key);
}

/** Clear persisted wallet key (e.g. when user disconnects in the wallet). */
export function clearLastWalletKey(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(NEXUS_LAST_WALLET_KEY);
}

function getEthereumProviders(): { byKey: Map<LastWalletKey, EIP1193Provider>; defaultProvider: EIP1193Provider | null } {
  const byKey = new Map<LastWalletKey, EIP1193Provider>();
  if (typeof window === "undefined") return { byKey, defaultProvider: null };
  const win = window as Window & { ethereum?: ProviderWithFlags & { providers?: ProviderWithFlags[] } };
  const ethereum = win.ethereum;
  if (!ethereum?.request) return { byKey, defaultProvider: null };

  const providers = Array.isArray(ethereum.providers) ? ethereum.providers : [ethereum];
  const metamask = providers.find((p) => (p as ProviderWithFlags)?.isMetaMask && !(p as ProviderWithFlags)?.isRabby && !(p as ProviderWithFlags)?.isRabbyWallet) as ProviderWithFlags | undefined;
  const rabby = providers.find((p) => (p as ProviderWithFlags)?.isRabby === true || (p as ProviderWithFlags)?.isRabbyWallet === true) as ProviderWithFlags | undefined;

  if (metamask?.request) byKey.set("metamask", metamask);
  if (rabby?.request) byKey.set("rabby", rabby);

  const defaultProvider = byKey.size >= 2 ? null : (ethereum as EIP1193Provider);
  // Ici, on sait déjà que `ethereum?.request` est défini (early-return plus haut),
  // donc on ne re-teste plus `ethereum?.request` pour éviter l'avertissement TS.
  if (byKey.size === 0) byKey.set("default", ethereum as EIP1193Provider);

  return { byKey, defaultProvider: defaultProvider ?? (ethereum as EIP1193Provider) };
}

/**
 * Restore selected provider from localStorage so it survives page reload.
 * Call this on app load (Navbar) and before any paid fetch so the wallet stays "connected".
 */
export function rehydrateProvider(): EIP1193Provider | null {
  if (typeof window === "undefined") return null;
  const key = getLastWalletKey();
  if (!key) return getSelectedProvider();
  const { byKey, defaultProvider } = getEthereumProviders();
  const provider = byKey.get(key) ?? defaultProvider ?? null;
  if (provider) setSelectedProvider(provider);
  return provider;
}

/** Clear store and persistence (call when user disconnects in the wallet). */
export function clearWalletConnection(): void {
  setSelectedProvider(null);
  clearLastWalletKey();
}
