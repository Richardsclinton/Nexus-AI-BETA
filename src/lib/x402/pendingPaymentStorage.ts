/**
 * Persist pending payment so reload / HMR doesn't lose state.
 * Key: x402_pending_payment. TTL: 5 min.
 */

const KEY = "x402_pending_payment";
const TTL_MS = 5 * 60 * 1000;

export type PendingPaymentStored = {
  txHash: string;
  requestBody: { message: string; referenceImageUrl?: string | null; isTrailer?: boolean; mode?: "trailer" };
  idemKey?: string;
  payTo?: string;
  createdAt: number;
};

export function savePendingPayment(data: Omit<PendingPaymentStored, "createdAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PendingPaymentStored = { ...data, createdAt: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function getPendingPayment(): PendingPaymentStored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PendingPaymentStored;
    if (Date.now() - data.createdAt > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearPendingPayment(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
