export type StoredMovement = {
  id: string;
  title: string;
  category: string;
  date: string;
  amount: number;
  kind: "income" | "expense" | "card" | "payment";
  account: string;
  createdAt?: string;
  updatedAt?: string;
};

const CACHE_KEY = "brujula-movements-cache-v2";
const OLD_SAMPLE_KEY = "finanzas-cop-movements-v1";
const DELETED_KEY = "brujula-deleted-movements-v1";

export function readCachedMovements(): StoredMovement[] {
  try {
    // Remove the old local-only sample data as part of the requested clean start.
    localStorage.removeItem(OLD_SAMPLE_KEY);
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? (JSON.parse(cached) as StoredMovement[]) : [];
  } catch {
    return [];
  }
}

export function cacheMovements(movements: StoredMovement[]) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(movements));
}

export function readDeletedMovementIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DELETED_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export function cacheDeletedMovementIds(ids: string[]) {
  localStorage.setItem(DELETED_KEY, JSON.stringify(ids));
}

export async function syncMovements(
  movements: StoredMovement[],
  deletedIds: string[] = [],
): Promise<StoredMovement[]> {
  const response = await fetch("/api/movements/sync", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ movements, deletedIds }),
  });
  if (!response.ok)
    throw new Error(`No se pudo sincronizar (${response.status})`);
  return (await response.json()) as StoredMovement[];
}
