type Status = "paid" | "executed";

interface Entry {
  status: Status;
  createdAt: number;
  responseBody?: any;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes

const store = new Map<string, Entry>();

function isExpired(entry: Entry): boolean {
  return Date.now() - entry.createdAt > TTL_MS;
}

export function getIdempotencyEntry(key: string | null | undefined): Entry | null {
  if (!key) return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function setIdempotencyStatus(key: string | null | undefined, status: Status): void {
  if (!key) return;
  const existing = getIdempotencyEntry(key);
  if (existing) {
    existing.status = status;
    return;
  }
  store.set(key, { status, createdAt: Date.now() });
}

export function setIdempotencyExecuted(key: string | null | undefined, responseBody: any): void {
  if (!key) return;
  const existing = getIdempotencyEntry(key);
  if (existing) {
    existing.status = "executed";
    existing.responseBody = responseBody;
    return;
  }
  store.set(key, { status: "executed", createdAt: Date.now(), responseBody });
}

