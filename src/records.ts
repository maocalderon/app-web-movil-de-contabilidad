export type ChecklistItem = { id: string; text: string; done: boolean };

export type ScheduledPayment = {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  reminderDays: number;
  recurrence: "none" | "monthly";
  paid: boolean;
  checklist: ChecklistItem[];
};

export type SavingsEntry = {
  id: string;
  title: string;
  amount: number;
  date: string;
  kind: "deposit" | "withdrawal";
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;
  if (!response.ok)
    throw new Error(result.error || "No se pudo guardar la información.");
  return result;
}

export const getPayments = () => request<ScheduledPayment[]>("/api/payments");

export const createPayment = (payment: {
  title: string;
  amount: number;
  dueDate: string;
  reminderDays: number;
  recurrence: "none" | "monthly";
  checklist: ChecklistItem[];
}) =>
  request<ScheduledPayment>("/api/payments", {
    method: "POST",
    body: JSON.stringify(payment),
  });

export const updatePayment = (
  id: string,
  update: {
    title?: string;
    amount?: number;
    dueDate?: string;
    reminderDays?: number;
    recurrence?: "none" | "monthly";
    paid?: boolean;
    checklist?: ChecklistItem[];
  },
) =>
  request<{ ok: true; nextPayment: ScheduledPayment | null }>(
    `/api/payments/${id}`,
    { method: "PATCH", body: JSON.stringify(update) },
  );

export const deletePayment = (id: string) =>
  request<{ ok: true }>(`/api/payments/${id}`, { method: "DELETE" });

export const getSavings = () => request<SavingsEntry[]>("/api/savings");

export const createSavingsEntry = (entry: {
  title: string;
  amount: number;
  date: string;
  kind: "deposit" | "withdrawal";
}) =>
  request<SavingsEntry>("/api/savings", {
    method: "POST",
    body: JSON.stringify(entry),
  });

export const deleteSavingsEntry = (id: string) =>
  request<{ ok: true }>(`/api/savings/${id}`, { method: "DELETE" });
