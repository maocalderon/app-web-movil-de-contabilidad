import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { calculateSummary } from "./finance";
import {
  cacheDeletedMovementIds,
  cacheMovements,
  readCachedMovements,
  readDeletedMovementIds,
  syncMovements,
  type StoredMovement,
} from "./storage";
import {
  createPayment,
  createSavingsEntry,
  deletePayment,
  deleteSavingsEntry,
  getPayments,
  getSavings,
  updatePayment,
  type ChecklistItem,
  type SavingsEntry,
  type ScheduledPayment,
} from "./records";
import "./App.css";

type Movement = StoredMovement;

type View =
  "Resumen" | "Movimientos" | "Pagos" | "Ahorro" | "Deudas" | "Presupuestos";
type AuthState =
  | { status: "checking" }
  | { status: "setup" }
  | { status: "login" }
  | { status: "offline"; username: string }
  | { status: "authenticated"; username: string };
type Theme = "dark" | "light";

const categories = [
  "Mercado",
  "Transporte",
  "Servicios",
  "Vivienda",
  "Salario",
  "Salud",
  "Entretenimiento",
  "Otros",
];
const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
const today = () => new Date().toISOString().slice(0, 10);
const todayLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const daysUntilDate = (date: string) => {
  const now = new Date();
  const today = new Date(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T12:00:00`,
  );
  return Math.round(
    (new Date(`${date}T12:00:00`).getTime() - today.getTime()) / 86_400_000,
  );
};
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
const decodeVapidKey = (key: string) => {
  const padded = `${key}${"=".repeat((4 - (key.length % 4)) % 4)}`;
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
};
const createUuid = () => {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
};

function Icon({ name, size = 19 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="M3 6h.01M3 12h.01M3 18h.01" />
      </>
    ),
    card: (
      <>
        <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
        <path d="M2.5 10h19M7 15h3" />
      </>
    ),
    debt: (
      <>
        <path d="M12 3v18M17 7.5c0-1.7-2.2-3-5-3s-5 1.3-5 3 2.2 3 5 3 5 1.3 5 3-2.2 3-5 3-5-1.3-5-3" />
      </>
    ),
    budget: (
      <>
        <path d="M4 19V5M4 19h17" />
        <path d="m7 15 4-4 3 2 6-7" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    arrow: (
      <>
        <path d="M7 17 17 7M7 7h10v10" />
      </>
    ),
    down: (
      <>
        <path d="M7 10l5 5 5-5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="2" />
        <path d="M3 8h18M16 14h.01" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    compass: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" />
        <path d="M12 2v2M22 12h-2M12 22v-2M2 12h2" />
      </>
    ),
    piggy: (
      <>
        <path d="M5 11.5c0-3.3 3.2-5.5 7.4-5.5 3.4 0 6.1 1.5 7.2 4h1.9v5h-2.2c-.7 1.5-2 2.6-3.8 3.2V21h-3v-2.2h-3V21h-3v-3.1A6 6 0 0 1 4 13.5H2v-3h3Z" />
        <path d="M9 6 7.5 3.8 11 5M16.5 10.5h.01M12 6v-2" />
        <path d="M11 12h5M13.5 9.5v5" />
      </>
    ),
    close: (
      <>
        <path d="m18 6-12 12M6 6l12 12" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </>
    ),
    moon: <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />,
    edit: (
      <>
        <path d="m15 5 4 4M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
      </>
    ),
  };
  return <svg {...common}>{paths[name] ?? paths.grid}</svg>;
}

function App() {
  const [movements, setMovements] = useState<Movement[]>(readCachedMovements);
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [savings, setSavings] = useState<SavingsEntry[]>([]);
  const [auth, setAuth] = useState<AuthState>({ status: "checking" });
  const [deletedIds, setDeletedIds] = useState<string[]>(
    readDeletedMovementIds,
  );
  const [syncStatus, setSyncStatus] = useState<
    "syncing" | "synced" | "offline"
  >("syncing");
  const [view, setView] = useState<View>(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    return [
      "Resumen",
      "Movimientos",
      "Pagos",
      "Ahorro",
      "Deudas",
      "Presupuestos",
    ].includes(requested || "")
      ? (requested as View)
      : "Resumen";
  });
  const [currentDate] = useState(() => new Date());
  const incomeGoalKey = `contavid-income-goal:${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  const [incomeGoal, setIncomeGoal] = useState<number | null>(() => {
    const stored = localStorage.getItem(incomeGoalKey);
    if (stored === null) return null;
    const value = Number(stored);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  });
  const [incomeGoalModalOpen, setIncomeGoalModalOpen] = useState(false);
  const [incomeGoalDraft, setIncomeGoalDraft] = useState("");
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("contavid_theme") === "light" ? "light" : "dark",
  );
  const monthLabel = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(currentDate);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("contavid_theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  const [modalOpen, setModalOpen] = useState(false);
  const [incomeEditorOpen, setIncomeEditorOpen] = useState(false);
  const [editingMovementId, setEditingMovementId] = useState<string | null>(
    null,
  );
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [savingsModalOpen, setSavingsModalOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const [pushEnabled, setPushEnabled] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [checklistDraft, setChecklistDraft] = useState<Record<string, string>>(
    {},
  );
  const [paymentForm, setPaymentForm] = useState({
    title: "",
    amount: "",
    dueDate: todayLocal(),
    reminderDays: "1",
    recurrence: "none" as "none" | "monthly",
    checklist: "",
  });
  const [savingsForm, setSavingsForm] = useState({
    title: "Ahorro",
    amount: "",
    date: todayLocal(),
    kind: "deposit" as "deposit" | "withdrawal",
  });
  const [form, setForm] = useState({
    title: "",
    amount: "",
    kind: "expense" as Movement["kind"],
    category: "Mercado",
    date: today(),
    account: "Efectivo",
  });

  useEffect(() => {
    let active = true;
    const checkAuth = async () => {
      try {
        const statusResponse = await fetch("/api/auth/status");
        if (!statusResponse.ok) throw new Error("No hay conexión con Contavid");
        const status = (await statusResponse.json()) as { configured: boolean };
        if (!status.configured) {
          if (active) setAuth({ status: "setup" });
          return;
        }
        const sessionResponse = await fetch("/api/auth/me");
        if (!sessionResponse.ok) {
          localStorage.removeItem("brujula_username_hint");
          if (active) setAuth({ status: "login" });
          return;
        }
        const user = (await sessionResponse.json()) as { username: string };
        localStorage.setItem("brujula_username_hint", user.username);
        if (active)
          setAuth({ status: "authenticated", username: user.username });
      } catch {
        const username = localStorage.getItem("brujula_username_hint");
        if (active && username) setAuth({ status: "offline", username });
        else if (active) setAuth({ status: "login" });
      }
    };
    void checkAuth();
    return () => {
      active = false;
    };
  }, []);

  const saveMovements = (next: Movement[], deleted = deletedIds) => {
    setMovements(next);
    setDeletedIds(deleted);
    cacheMovements(next);
    cacheDeletedMovementIds(deleted);
    setSyncStatus("syncing");
    void syncMovements(next, deleted)
      .then((synced) => {
        setMovements(synced);
        setDeletedIds([]);
        cacheMovements(synced);
        cacheDeletedMovementIds([]);
        setSyncStatus("synced");
      })
      .catch(() => setSyncStatus("offline"));
  };

  useEffect(() => {
    if (auth.status !== "authenticated" && auth.status !== "offline") return;
    let active = true;
    const synchronize = () => {
      setSyncStatus("syncing");
      void syncMovements(readCachedMovements(), readDeletedMovementIds())
        .then((synced) => {
          if (!active) return;
          setMovements(synced);
          setDeletedIds([]);
          cacheMovements(synced);
          cacheDeletedMovementIds([]);
          setSyncStatus("synced");
        })
        .catch(() => {
          if (active) setSyncStatus("offline");
        });
    };
    synchronize();
    window.addEventListener("online", synchronize);
    return () => {
      active = false;
      window.removeEventListener("online", synchronize);
    };
  }, [auth.status]);

  useEffect(() => {
    if (auth.status !== "authenticated" && auth.status !== "offline") return;
    let active = true;
    const refreshRecords = async () => {
      const [paymentResult, savingsResult] = await Promise.allSettled([
        getPayments(),
        getSavings(),
      ]);
      if (!active) return;
      if (paymentResult.status === "fulfilled")
        setPayments(paymentResult.value);
      if (savingsResult.status === "fulfilled") setSavings(savingsResult.value);
      if (
        paymentResult.status === "rejected" ||
        savingsResult.status === "rejected"
      ) {
        setNotice("No se pudieron actualizar pagos o ahorros.");
      }
    };
    void refreshRecords();
    window.addEventListener("online", refreshRecords);
    return () => {
      active = false;
      window.removeEventListener("online", refreshRecords);
    };
  }, [auth.status]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const checkReminders = () => {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const todayDate = new Date(`${todayKey}T12:00:00`);
      for (const payment of payments) {
        if (payment.paid) continue;
        const dueDate = new Date(`${payment.dueDate}T12:00:00`);
        const daysUntil = Math.round(
          (dueDate.getTime() - todayDate.getTime()) / 86_400_000,
        );
        if (daysUntil < 0 || daysUntil > payment.reminderDays) continue;
        const key = `contavid-reminder:${payment.id}:${payment.dueDate}`;
        if (localStorage.getItem(key)) continue;
        localStorage.setItem(key, todayKey);
        const title = `Pago próximo: ${payment.title}`;
        const body = `${daysUntil === 0 ? "Vence hoy" : `Vence en ${daysUntil} día${daysUntil === 1 ? "" : "s"}`} · ${formatCOP(payment.amount)}`;
        if (!pushEnabled) setNotice(`${title}. ${body}`);
        const checklist = payment.checklist.some((item) => item.id === key)
          ? payment.checklist
          : [
              ...payment.checklist,
              { id: key, text: `🔔 ${body}`, done: false },
            ].slice(-20);
        setPayments((current) =>
          current.map((item) =>
            item.id === payment.id ? { ...item, checklist } : item,
          ),
        );
        void updatePayment(payment.id, { checklist }).catch(() => {
          localStorage.removeItem(key);
        });
      }
    };
    checkReminders();
    const interval = window.setInterval(checkReminders, 60 * 60 * 1000);
    window.addEventListener("focus", checkReminders);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkReminders);
    };
  }, [auth.status, payments, pushEnabled]);

  useEffect(() => {
    if (
      auth.status !== "authenticated" ||
      !("serviceWorker" in navigator) ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    let active = true;
    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (active) setPushEnabled(Boolean(subscription));
      })
      .catch(() => {
        if (active) setPushEnabled(false);
      });
    return () => {
      active = false;
    };
  }, [auth.status]);
  const totals = useMemo(() => calculateSummary(movements), [movements]);
  const savingsBalance = useMemo(
    () =>
      savings.reduce(
        (total, entry) =>
          total + (entry.kind === "deposit" ? entry.amount : -entry.amount),
        0,
      ),
    [savings],
  );
  const openPayments = useMemo(
    () => payments.filter((payment) => !payment.paid),
    [payments],
  );
  const nextPayment = openPayments[0];
  const currentMonthKey = incomeGoalKey.slice("contavid-income-goal:".length);
  const monthIncomeMovements = movements.filter(
    (movement) =>
      movement.kind === "income" && movement.date.startsWith(currentMonthKey),
  );
  const filteredMovements = movements.filter((m) =>
    `${m.title} ${m.category} ${m.account}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  function addMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Math.round(Number(form.amount));
    if (!form.title.trim() || !amount || amount < 1) return;
    const now = new Date().toISOString();
    const next = editingMovementId
      ? movements.map((movement) =>
          movement.id === editingMovementId
            ? {
                ...movement,
                ...form,
                title: form.title.trim(),
                amount,
                updatedAt: now,
              }
            : movement,
        )
      : [
          {
            ...form,
            id: globalThis.crypto.randomUUID?.() ?? createUuid(),
            title: form.title.trim(),
            amount,
            createdAt: now,
            updatedAt: now,
          },
          ...movements,
        ];
    saveMovements(next);
    const wasEditing = Boolean(editingMovementId);
    setEditingMovementId(null);
    setForm({
      title: "",
      amount: "",
      kind: "expense",
      category: "Mercado",
      date: today(),
      account: "Efectivo",
    });
    setModalOpen(false);
    setNotice(wasEditing ? "Ingreso actualizado" : "Movimiento guardado");
    window.setTimeout(() => setNotice(""), 2600);
  }

  function editIncome(movement: Movement) {
    setForm({
      title: movement.title,
      amount: String(movement.amount),
      kind: "income",
      category: movement.category,
      date: movement.date,
      account: movement.account,
    });
    setEditingMovementId(movement.id);
    setIncomeEditorOpen(false);
    setModalOpen(true);
  }

  function startIncomeEntry() {
    setForm({
      title: "",
      amount: "",
      kind: "income",
      category: "Salario",
      date: today(),
      account: "Efectivo",
    });
    setEditingMovementId(null);
    setIncomeEditorOpen(false);
    setModalOpen(true);
  }

  async function addScheduledPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Math.round(Number(paymentForm.amount));
    if (!paymentForm.title.trim() || !amount || amount < 1) return;
    const existingPayment = editingPaymentId
      ? payments.find((payment) => payment.id === editingPaymentId)
      : undefined;
    const userTasks: ChecklistItem[] = paymentForm.checklist
      .split("\n")
      .map((text) => text.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((text) => ({
        id:
          existingPayment?.checklist.find(
            (item) =>
              !item.id.startsWith("contavid-reminder:") && item.text === text,
          )?.id ??
          globalThis.crypto.randomUUID?.() ??
          createUuid(),
        text,
        done:
          existingPayment?.checklist.find(
            (item) =>
              !item.id.startsWith("contavid-reminder:") && item.text === text,
          )?.done ?? false,
      }));
    const checklist = [
      ...userTasks,
      ...(existingPayment?.checklist.filter((item) =>
        item.id.startsWith("contavid-reminder:"),
      ) || []),
    ].slice(0, 20);
    try {
      const details = {
        title: paymentForm.title.trim(),
        amount,
        dueDate: paymentForm.dueDate,
        reminderDays: Number(paymentForm.reminderDays),
        recurrence: paymentForm.recurrence,
      };
      if (editingPaymentId) {
        await updatePayment(editingPaymentId, { ...details, checklist });
        setPayments((current) =>
          current
            .map((payment) =>
              payment.id === editingPaymentId
                ? { ...payment, ...details, checklist }
                : payment,
            )
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
        );
      } else {
        const created = await createPayment({ ...details, checklist });
        setPayments((current) =>
          [...current, created].sort((a, b) =>
            a.dueDate.localeCompare(b.dueDate),
          ),
        );
      }
      setPaymentForm({
        title: "",
        amount: "",
        dueDate: todayLocal(),
        reminderDays: "1",
        recurrence: "none",
        checklist: "",
      });
      setPaymentModalOpen(false);
      setEditingPaymentId(null);
      setNotice(editingPaymentId ? "Deuda actualizada" : "Deuda programada");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se guardó el pago.",
      );
    }
  }

  function openDebtEditor(payment?: ScheduledPayment) {
    setPaymentForm(
      payment
        ? {
            title: payment.title,
            amount: String(payment.amount),
            dueDate: payment.dueDate,
            reminderDays: String(payment.reminderDays),
            recurrence: payment.recurrence,
            checklist: payment.checklist
              .filter((item) => !item.id.startsWith("contavid-reminder:"))
              .map((item) => item.text)
              .join("\n"),
          }
        : {
            title: "",
            amount: "",
            dueDate: todayLocal(),
            reminderDays: "1",
            recurrence: "none",
            checklist: "",
          },
    );
    setEditingPaymentId(payment?.id || null);
    setPaymentModalOpen(true);
  }

  async function markPaymentPaid(payment: ScheduledPayment) {
    try {
      const result = await updatePayment(payment.id, { paid: !payment.paid });
      const refreshed = await getPayments();
      setPayments(refreshed);
      setNotice(
        payment.paid
          ? "Pago marcado como pendiente"
          : result.nextPayment
            ? "Pago listo. Se creó la siguiente cuota mensual."
            : "Pago marcado como realizado",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el pago.",
      );
    }
  }

  async function toggleChecklistItem(
    payment: ScheduledPayment,
    itemId: string,
  ) {
    const checklist = payment.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item,
    );
    setPayments((current) =>
      current.map((item) =>
        item.id === payment.id ? { ...item, checklist } : item,
      ),
    );
    try {
      await updatePayment(payment.id, { checklist });
    } catch (error) {
      setPayments((current) =>
        current.map((item) => (item.id === payment.id ? payment : item)),
      );
      setNotice(
        error instanceof Error ? error.message : "No se guardó la lista.",
      );
    }
  }

  async function addChecklistItem(payment: ScheduledPayment) {
    const text = checklistDraft[payment.id]?.trim();
    if (!text) return;
    if (payment.checklist.length >= 20) {
      setNotice("Cada pago admite hasta 20 tareas.");
      return;
    }
    const checklist = [
      ...payment.checklist,
      {
        id: globalThis.crypto.randomUUID?.() ?? createUuid(),
        text,
        done: false,
      },
    ];
    try {
      await updatePayment(payment.id, { checklist });
      setPayments((current) =>
        current.map((item) =>
          item.id === payment.id ? { ...item, checklist } : item,
        ),
      );
      setChecklistDraft((current) => ({ ...current, [payment.id]: "" }));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se guardó la tarea.",
      );
    }
  }

  async function removeScheduledPayment(payment: ScheduledPayment) {
    if (
      !window.confirm(
        `¿Eliminar “${payment.title}” y su checklist? Esta acción no se puede deshacer.`,
      )
    )
      return;
    try {
      await deletePayment(payment.id);
      setPayments((current) =>
        current.filter((item) => item.id !== payment.id),
      );
      setNotice("Pago eliminado");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se eliminó el pago.",
      );
    }
  }

  async function addSavings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Math.round(Number(savingsForm.amount));
    if (!savingsForm.title.trim() || !amount || amount < 1) return;
    try {
      const created = await createSavingsEntry({
        ...savingsForm,
        title: savingsForm.title.trim(),
        amount,
      });
      setSavings((current) => [created, ...current]);
      setSavingsForm({
        title: "Ahorro",
        amount: "",
        date: todayLocal(),
        kind: "deposit",
      });
      setSavingsModalOpen(false);
      setNotice(
        created.kind === "deposit" ? "Ahorro registrado" : "Retiro registrado",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se guardó el ahorro.",
      );
    }
  }

  async function removeSavings(entry: SavingsEntry) {
    if (!window.confirm(`¿Eliminar el registro “${entry.title}”?`)) return;
    try {
      await deleteSavingsEntry(entry.id);
      setSavings((current) => current.filter((item) => item.id !== entry.id));
      setNotice("Registro eliminado");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se eliminó el registro.",
      );
    }
  }

  function saveIncomeGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Math.round(Number(incomeGoalDraft));
    if (!Number.isSafeInteger(amount) || amount < 1) {
      setNotice("Ingresa una meta mensual mayor que cero.");
      return;
    }
    localStorage.setItem(incomeGoalKey, String(amount));
    setIncomeGoal(amount);
    setIncomeGoalModalOpen(false);
    setNotice("Meta mensual de ingresos actualizada");
  }

  function clearIncomeGoal() {
    localStorage.removeItem(incomeGoalKey);
    setIncomeGoal(null);
    setIncomeGoalDraft("");
    setIncomeGoalModalOpen(false);
    setNotice("Meta mensual eliminada; los ingresos registrados no cambiaron.");
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      setNotice(
        "Para avisos push en iPhone, agrega Contavid a la pantalla de inicio y actívalos desde allí.",
      );
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== "granted") {
        setNotice(
          "No se concedió permiso. Los pagos próximos seguirán apareciendo en Contavid.",
        );
        return;
      }
      if (!("serviceWorker" in navigator)) {
        setNotice(
          "Este navegador no admite notificaciones push. Los avisos aparecerán dentro de Contavid.",
        );
        return;
      }
      const keyResponse = await fetch("/api/push/public-key");
      const keyResult = (await keyResponse.json()) as {
        publicKey?: string;
        error?: string;
      };
      if (!keyResponse.ok || !keyResult.publicKey)
        throw new Error(
          keyResult.error ||
            "Notificaciones push no configuradas en el servidor.",
        );
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(
            keyResult.publicKey,
          ) as BufferSource,
        }));
      const saved = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!saved.ok)
        throw new Error("No se pudo guardar esta suscripción en Contavid.");
      setPushEnabled(true);
      setNotice(
        "Avisos push activados. Te recordaremos aunque Contavid esté cerrada.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "En iPhone, instala Contavid en la pantalla de inicio y vuelve a intentarlo.",
      );
    }
  }

  const nav: { label: View; icon: string }[] = [
    { label: "Resumen", icon: "grid" },
    { label: "Movimientos", icon: "list" },
    { label: "Pagos", icon: "calendar" },
    { label: "Ahorro", icon: "piggy" },
    { label: "Deudas", icon: "debt" },
    { label: "Presupuestos", icon: "budget" },
  ];
  const chart = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 5 + index,
        1,
      );
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        month: new Intl.DateTimeFormat("es-CO", { month: "short" }).format(
          date,
        ),
        income: 0,
        expense: 0,
      };
    });
    const byMonth = new Map(months.map((month) => [month.key, month]));
    movements.forEach((movement) => {
      const month = byMonth.get(movement.date.slice(0, 7));
      if (!month) return;
      if (movement.kind === "income") month.income += movement.amount;
      if (movement.kind === "expense" || movement.kind === "card")
        month.expense += movement.amount;
    });
    return months;
  }, [currentDate, movements]);
  const maxChart = Math.max(
    1,
    ...chart.flatMap((month) => [month.income, month.expense]),
  );
  const budgets: {
    name: string;
    spent: number;
    limit: number;
    color: string;
    icon: string;
  }[] = [];

  if (auth.status === "checking") {
    return <div className="auth-loading">Conectando con Contavid…</div>;
  }
  if (auth.status === "setup" || auth.status === "login") {
    return (
      <AuthScreen
        mode={auth.status}
        theme={theme}
        onToggleTheme={toggleTheme}
        onAuthenticated={(username) => {
          localStorage.setItem("brujula_username_hint", username);
          setAuth({ status: "authenticated", username });
        }}
      />
    );
  }
  const username = auth.username;
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    localStorage.removeItem("brujula_username_hint");
    setAuth({ status: "login" });
  };

  return (
    <div className={`app-shell theme-${theme}`}>
      <aside className="sidebar">
        <a className="brand" href="#inicio" onClick={() => setView("Resumen")}>
          <span className="brand-mark">
            <img src="/contavid-icon.png" alt="" />
          </span>
          <span>
            Contavid<span className="brand-dot">.</span>
            <small>FINANZAS · MODO SEGURO</small>
          </span>
        </a>
        <div className="workspace-label">ESPACIO PERSONAL</div>
        <nav className="side-nav" aria-label="Navegación principal">
          {nav.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${view === item.label ? "active" : ""}`}
              onClick={() => setView(item.label)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.label === "Movimientos" && (
                <span className="nav-count">{movements.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="safe-card">
            <span className="safe-icon">
              <Icon name="shield" size={17} />
            </span>
            <div>
              <strong>Tus datos están aquí</strong>
              <p>Guardados en este dispositivo.</p>
            </div>
          </div>
          <button className="profile-button" onClick={() => void logout()}>
            <span className="avatar">{username.slice(0, 1).toUpperCase()}</span>
            <span className="profile-copy">
              <strong>{username}</strong>
              <small>Cuenta protegida</small>
            </span>
            <span className="logout-button">Salir</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Mi espacio <span>/</span> <strong>{view}</strong>
          </div>
          <div className="top-actions">
            <span className={`offline-pill ${syncStatus}`}>
              <i />{" "}
              {syncStatus === "syncing"
                ? "Sincronizando…"
                : syncStatus === "synced"
                  ? "Guardado en PostgreSQL"
                  : "Sin conexión · guardado local"}
            </span>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Cambiar a modo ${theme === "dark" ? "claro" : "noche"}`}
              title={`Cambiar a modo ${theme === "dark" ? "claro" : "noche"}`}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
              <span>{theme === "dark" ? "Claro" : "Noche"}</span>
            </button>
            <button
              className={`icon-button notification-button ${notificationPermission === "granted" ? "notifications-on" : ""}`}
              aria-label="Activar recordatorios de pagos"
              title="Activar recordatorios de pagos"
              onClick={() => void enableNotifications()}
            >
              <Icon name="bell" />
            </button>
            <span className="avatar top-avatar">
              {username.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">TU DINERO, MÁS CLARO</div>
              <h1>{view === "Resumen" ? `Hola, ${username}` : view}</h1>
              <p>
                {view === "Resumen" ? (
                  <>
                    Este es el resumen de tus finanzas para{" "}
                    <span className="capitalize">{monthLabel}</span>.
                  </>
                ) : (
                  `Consulta y organiza tus ${view.toLowerCase()} en un solo lugar.`
                )}
              </p>
            </div>
            <div className="heading-actions">
              <button className="date-button">
                <Icon name="calendar" size={16} />
                <span>{monthLabel}</span>
                <Icon name="down" size={15} />
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  setEditingMovementId(null);
                  setForm({
                    title: "",
                    amount: "",
                    kind: "expense",
                    category: "Mercado",
                    date: today(),
                    account: "Efectivo",
                  });
                  setModalOpen(true);
                }}
              >
                <Icon name="plus" size={18} /> Nuevo movimiento
              </button>
            </div>
          </div>

          {view === "Resumen" && (
            <>
              <section
                className="home-holiday-banner"
                aria-label="Saludo navideño de Contavid"
              >
                <div className="home-holiday-brand">
                  <img src="/contavid-icon.png" alt="Logo de Contavid" />
                  <span>CONTAVID</span>
                </div>
                <div className="home-holiday-copy">
                  <span>UN DICIEMBRE CON MÁS CLARIDAD</span>
                  <h2>Que la música y la alegría acompañen tus fiestas</h2>
                  <p>Organiza tus finanzas y disfruta cada momento.</p>
                </div>
                <img
                  className="home-holiday-portrait"
                  src="/diomedes-navidad.jpg"
                  alt="Ilustración navideña de Diomedes Díaz con gorro de Santa"
                />
              </section>
              <section className="stat-grid" aria-label="Resumen financiero">
                <article className="stat-card balance-card">
                  <div className="stat-top">
                    <span>Balance disponible</span>
                    <span className="stat-icon lavender">
                      <Icon name="wallet" size={17} />
                    </span>
                  </div>
                  <strong>{formatCOP(totals.balance)}</strong>
                  <div className="stat-foot">
                    <span className="trend neutral">
                      Tus movimientos registrados
                    </span>
                  </div>
                </article>
                <article className="stat-card">
                  <div className="stat-top">
                    <span>Ingresos del mes</span>
                    <div className="income-card-actions">
                      <span className="stat-icon green">
                        <span>↙</span>
                      </span>
                      <button
                        className="income-goal-edit"
                        onClick={() => setIncomeEditorOpen(true)}
                        aria-label="Editar ingresos registrados del mes"
                        title="Editar ingresos registrados"
                      >
                        <Icon name="edit" size={14} />
                      </button>
                    </div>
                  </div>
                  <strong>{formatCOP(totals.income)}</strong>
                  <div className="stat-foot income-goal-foot">
                    {incomeGoal === null ? (
                      <span>
                        {monthIncomeMovements.length} ingreso(s) registrado(s)
                      </span>
                    ) : (
                      <span>Meta {formatCOP(incomeGoal)}</span>
                    )}
                    <button
                      className="income-goal-label"
                      onClick={() => {
                        setIncomeGoalDraft(incomeGoal?.toString() || "");
                        setIncomeGoalModalOpen(true);
                      }}
                    >
                      {incomeGoal === null ? "Definir meta" : "Editar meta"}
                    </button>
                  </div>
                  {incomeGoal !== null && (
                    <div
                      className="income-goal-track"
                      aria-label={`${Math.min(100, Math.round((totals.income / incomeGoal) * 100))}% de la meta de ingresos`}
                    >
                      <span
                        style={{
                          width: `${Math.min(100, (totals.income / incomeGoal) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </article>
                <article className="stat-card">
                  <div className="stat-top">
                    <span>Gastos del mes</span>
                    <span className="stat-icon peach">
                      <span>↗</span>
                    </span>
                  </div>
                  <strong>{formatCOP(totals.expenses)}</strong>
                  <div className="stat-foot">
                    <span className="trend neutral">En efectivo y tarjeta</span>
                  </div>
                </article>
                <article className="stat-card">
                  <div className="stat-top">
                    <span>Ahorrado</span>
                    <span className="stat-icon blue">
                      <Icon name="piggy" size={17} />
                    </span>
                  </div>
                  <strong>{formatCOP(savingsBalance)}</strong>
                  <div className="stat-foot">
                    <button
                      className="trend-link"
                      onClick={() => setView("Ahorro")}
                    >
                      Ver mis ahorros →
                    </button>
                  </div>
                </article>
              </section>

              {nextPayment && (
                <button
                  className="upcoming-payment-banner"
                  onClick={() => setView("Pagos")}
                >
                  <span className="upcoming-payment-icon">
                    <Icon name="calendar" size={19} />
                  </span>
                  <span>
                    <strong>Próximo pago · {nextPayment.title}</strong>
                    <small>
                      {daysUntilDate(nextPayment.dueDate) < 0
                        ? `Vencido · ${dateLabel(nextPayment.dueDate)}`
                        : `${dateLabel(nextPayment.dueDate)} · ${daysUntilDate(nextPayment.dueDate) === 0 ? "vence hoy" : `faltan ${daysUntilDate(nextPayment.dueDate)} días`}`}
                    </small>
                  </span>
                  <strong>{formatCOP(nextPayment.amount)}</strong>
                  <span aria-hidden="true">→</span>
                </button>
              )}

              <section className="content-grid">
                <article className="panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Flujo de dinero</h2>
                      <p>Ingresos y gastos en los últimos 6 meses</p>
                    </div>
                    <button className="select-button">
                      Últimos 6 meses <Icon name="down" size={14} />
                    </button>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i className="legend-income" />
                      Ingresos
                    </span>
                    <span>
                      <i className="legend-expense" />
                      Gastos
                    </span>
                  </div>
                  <div className="chart-area">
                    <div className="y-labels">
                      {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                        <span key={ratio}>
                          {formatCOP(Math.round(maxChart * ratio))}
                        </span>
                      ))}
                    </div>
                    <div className="bar-chart">
                      {movements.length === 0 ? (
                        <p className="chart-empty">
                          Cuando registres movimientos, aquí verás tu flujo de
                          dinero.
                        </p>
                      ) : (
                        chart.map((item) => (
                          <div className="bar-group" key={item.key}>
                            <div className="bars">
                              <div
                                className="bar income-bar"
                                style={{
                                  height: item.income
                                    ? `${Math.max(5, (item.income / maxChart) * 100)}%`
                                    : "0%",
                                }}
                                title={`Ingresos ${formatCOP(item.income)}`}
                              />
                              <div
                                className="bar expense-bar"
                                style={{
                                  height: item.expense
                                    ? `${Math.max(5, (item.expense / maxChart) * 100)}%`
                                    : "0%",
                                }}
                                title={`Gastos ${formatCOP(item.expense)}`}
                              />
                            </div>
                            <span>{item.month}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </article>
                <article className="panel budget-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Presupuestos</h2>
                      <p>Así va tu gasto este mes</p>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setView("Presupuestos")}
                    >
                      Ver todos <span>→</span>
                    </button>
                  </div>
                  <div className="budget-list">
                    {budgets.length === 0 ? (
                      <p className="empty-hint">
                        Aún no has creado presupuestos.
                      </p>
                    ) : (
                      budgets.map((budget) => (
                        <div className="budget-row" key={budget.name}>
                          <div className="budget-info">
                            <span className={`budget-emoji ${budget.color}`}>
                              {budget.icon}
                            </span>
                            <div className="budget-name">
                              <strong>{budget.name}</strong>
                              <span>
                                {formatCOP(budget.spent)}{" "}
                                <small>de {formatCOP(budget.limit)}</small>
                              </span>
                            </div>
                            <span className="budget-percent">
                              {Math.round((budget.spent / budget.limit) * 100)}%
                            </span>
                          </div>
                          <div className="progress-track">
                            <div
                              className={`progress-fill ${budget.color}`}
                              style={{
                                width: `${(budget.spent / budget.limit) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    className="budget-footer"
                    onClick={() => setView("Presupuestos")}
                  >
                    Administrar presupuestos <span>→</span>
                  </button>
                </article>
              </section>

              <section className="lower-grid">
                <article className="panel transactions-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Movimientos recientes</h2>
                      <p>Últimos registros de tus cuentas</p>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setView("Movimientos")}
                    >
                      Ver movimientos <span>→</span>
                    </button>
                  </div>
                  <MovementTable
                    movements={movements.slice(0, 5)}
                    onDelete={(id) =>
                      saveMovements(
                        movements.filter((m) => m.id !== id),
                        [...deletedIds, id],
                      )
                    }
                  />
                </article>
              </section>
            </>
          )}

          {view === "Movimientos" && (
            <section className="panel full-panel">
              <div className="table-toolbar">
                <div>
                  <h2>Todos los movimientos</h2>
                  <p>
                    {movements.length} registros sincronizados con PostgreSQL
                  </p>
                </div>
                <label className="search-box">
                  <Icon name="search" size={17} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar movimiento"
                  />
                </label>
              </div>
              <MovementTable
                movements={filteredMovements}
                onDelete={(id) =>
                  saveMovements(
                    movements.filter((m) => m.id !== id),
                    [...deletedIds, id],
                  )
                }
              />
            </section>
          )}
          {view === "Pagos" && (
            <section className="payments-page">
              <div className="panel payments-intro">
                <div className="payments-intro-icon">
                  <Icon name="bell" size={21} />
                </div>
                <div>
                  <strong>Que no se te pase ninguna cuota</strong>
                  <p>
                    Programa una fecha, agrega tareas y recibe avisos antes del
                    vencimiento.
                  </p>
                </div>
                <button
                  className="secondary-button notification-enable-button"
                  onClick={() => void enableNotifications()}
                >
                  <Icon name="bell" size={15} />{" "}
                  {pushEnabled ? "Avisos activos" : "Activar avisos"}
                </button>
                <button
                  className="primary-button"
                  onClick={() => openDebtEditor()}
                >
                  <Icon name="plus" size={17} /> Programar pago
                </button>
              </div>
              {openPayments.length > 0 && (
                <div className="payment-list">
                  {openPayments.map((payment) => {
                    const days = daysUntilDate(payment.dueDate);
                    const dueLabel =
                      days < 0
                        ? `Venció hace ${Math.abs(days)} día${days === -1 ? "" : "s"}`
                        : days === 0
                          ? "Vence hoy"
                          : days === 1
                            ? "Vence mañana"
                            : `Faltan ${days} días`;
                    return (
                      <article
                        className={`panel payment-card ${days <= payment.reminderDays ? "payment-soon" : ""} ${days < 0 ? "payment-overdue" : ""}`}
                        key={payment.id}
                      >
                        <div className="payment-card-top">
                          <span className="payment-calendar-icon">
                            <Icon name="calendar" size={19} />
                          </span>
                          <div className="payment-title-block">
                            <h2>{payment.title}</h2>
                            <p>
                              {dateLabel(payment.dueDate)}
                              {payment.recurrence === "monthly"
                                ? " · Cuota mensual"
                                : ""}
                            </p>
                          </div>
                          <span
                            className={`due-badge ${days < 0 ? "overdue" : days <= payment.reminderDays ? "soon" : ""}`}
                          >
                            {dueLabel}
                          </span>
                        </div>
                        <strong className="payment-amount">
                          {formatCOP(payment.amount)}
                        </strong>
                        {payment.checklist.length > 0 && (
                          <div className="payment-checklist">
                            <span className="checklist-label">
                              LISTA ·{" "}
                              {
                                payment.checklist.filter((item) => item.done)
                                  .length
                              }
                              /{payment.checklist.length}
                            </span>
                            {payment.checklist.map((item) => (
                              <label
                                className={`checklist-item ${item.done ? "checked" : ""}`}
                                key={item.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={item.done}
                                  onChange={() =>
                                    void toggleChecklistItem(payment, item.id)
                                  }
                                />
                                <span>{item.text}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        <form
                          className="add-checklist-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void addChecklistItem(payment);
                          }}
                        >
                          <input
                            aria-label={`Agregar tarea a ${payment.title}`}
                            placeholder="Agregar tarea (ej. confirmar pago)"
                            value={checklistDraft[payment.id] || ""}
                            onChange={(event) =>
                              setChecklistDraft((current) => ({
                                ...current,
                                [payment.id]: event.target.value,
                              }))
                            }
                          />
                          <button type="submit" className="secondary-button">
                            + Tarea
                          </button>
                        </form>
                        <div className="payment-card-actions">
                          <span>
                            Recordatorio{" "}
                            {payment.reminderDays === 0
                              ? "el mismo día"
                              : `${payment.reminderDays} día${payment.reminderDays === 1 ? "" : "s"} antes`}
                          </span>
                          <button
                            className="secondary-button"
                            onClick={() => openDebtEditor(payment)}
                          >
                            Editar
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() => void removeScheduledPayment(payment)}
                          >
                            Eliminar
                          </button>
                          <button
                            className="primary-button"
                            onClick={() => void markPaymentPaid(payment)}
                          >
                            Marcar pagado
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              {payments.filter((payment) => payment.paid).length > 0 && (
                <section className="panel paid-payments-panel">
                  <h2>Pagos realizados</h2>
                  {payments
                    .filter((payment) => payment.paid)
                    .map((payment) => (
                      <div className="paid-payment-row" key={payment.id}>
                        <span>
                          <Icon name="shield" size={17} />
                        </span>
                        <div>
                          <strong>{payment.title}</strong>
                          <small>{dateLabel(payment.dueDate)}</small>
                        </div>
                        <strong>{formatCOP(payment.amount)}</strong>
                        <button
                          className="text-link"
                          onClick={() => void markPaymentPaid(payment)}
                        >
                          Deshacer
                        </button>
                      </div>
                    ))}
                </section>
              )}
              {payments.length === 0 && (
                <section className="panel empty-state payment-empty-state">
                  <span className="empty-icon">
                    <Icon name="calendar" size={25} />
                  </span>
                  <h2>Tus pagos, bajo control</h2>
                  <p>
                    Agrega la cuota del arriendo, servicios o tarjeta. Contavid
                    te mostrará cuándo vence y te ayudará con una lista de
                    pasos.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => setPaymentModalOpen(true)}
                  >
                    <Icon name="plus" size={17} /> Agregar primer pago
                  </button>
                </section>
              )}
              <p className="notification-limit-note">
                Los recordatorios push se revisan una vez al día. En iPhone,
                agrega Contavid a la pantalla de inicio y permite las
                notificaciones para recibirlos aunque la app esté cerrada.
              </p>
            </section>
          )}

          {view === "Ahorro" && (
            <section className="savings-page">
              <article className="savings-total-card">
                <div className="savings-total-copy">
                  <span className="eyebrow">TU ALCANCÍA DIGITAL</span>
                  <h2>Esto llevas ahorrado</h2>
                  <strong>{formatCOP(savingsBalance)}</strong>
                  <p>
                    Registra cada aporte o retiro para mantener tu total al día.
                  </p>
                </div>
                <img src="/contavid-icon.png" alt="Alcancía Contavid" />
                <button
                  className="primary-button"
                  onClick={() => {
                    setSavingsForm({
                      title: "Ahorro",
                      amount: "",
                      date: todayLocal(),
                      kind: "deposit",
                    });
                    setSavingsModalOpen(true);
                  }}
                >
                  <Icon name="plus" size={17} /> Registrar ahorro
                </button>
              </article>
              <section className="panel savings-history">
                <div className="panel-heading">
                  <div>
                    <h2>Historial de ahorro</h2>
                    <p>
                      {savings.length} registro{savings.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setSavingsForm({
                        title: "Retiro",
                        amount: "",
                        date: todayLocal(),
                        kind: "withdrawal",
                      });
                      setSavingsModalOpen(true);
                    }}
                  >
                    Registrar retiro
                  </button>
                </div>
                {savings.length === 0 ? (
                  <p className="empty-hint savings-empty">
                    Tu primer aporte aparecerá aquí.
                  </p>
                ) : (
                  <div className="savings-list">
                    {savings.map((entry) => (
                      <div className="savings-row" key={entry.id}>
                        <span className={`savings-entry-icon ${entry.kind}`}>
                          <Icon
                            name={entry.kind === "deposit" ? "piggy" : "wallet"}
                            size={18}
                          />
                        </span>
                        <div className="savings-entry-copy">
                          <strong>{entry.title}</strong>
                          <small>{dateLabel(entry.date)}</small>
                        </div>
                        <strong
                          className={
                            entry.kind === "deposit"
                              ? "savings-positive"
                              : "savings-negative"
                          }
                        >
                          {entry.kind === "deposit" ? "+" : "−"}
                          {formatCOP(entry.amount)}
                        </strong>
                        <button
                          className="row-action"
                          aria-label={`Eliminar ${entry.title}`}
                          onClick={() => void removeSavings(entry)}
                        >
                          <Icon name="more" size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </section>
          )}

          {view === "Deudas" && (
            <section className="debt-page">
              <div className="panel debt-overview">
                <div className="debt-overview-title">
                  <span className="debt-overview-icon">
                    <Icon name="debt" size={21} />
                  </span>
                  <div>
                    <span className="eyebrow">PLAN DE PAGOS</span>
                    <h2>Deudas por pagar</h2>
                    <p>
                      Organiza vencimientos, activa recordatorios y sigue tus
                      tareas.
                    </p>
                  </div>
                </div>
                <div className="debt-overview-total">
                  <span>Total pendiente</span>
                  <strong>
                    {formatCOP(
                      openPayments.reduce((sum, item) => sum + item.amount, 0),
                    )}
                  </strong>
                  <small>{openPayments.length} deuda(s) activa(s)</small>
                </div>
                <button
                  className="primary-button"
                  onClick={() => openDebtEditor()}
                >
                  <Icon name="plus" size={17} /> Registrar deuda
                </button>
              </div>
              <div className="debt-list-heading">
                <h2>Próximos vencimientos</h2>
                <span>{openPayments.length} pendientes</span>
              </div>
              {openPayments.length ? (
                <div className="debt-card-grid">
                  {openPayments.map((payment) => {
                    const days = daysUntilDate(payment.dueDate);
                    const reminderTask = payment.checklist.find(
                      (task) =>
                        task.id.startsWith("contavid-reminder:") && !task.done,
                    );
                    return (
                      <article
                        className={`panel debt-card ${days < 0 ? "debt-card-overdue" : ""}`}
                        key={payment.id}
                      >
                        <div className="debt-card-head">
                          <span className="debt-card-icon">
                            <Icon name="calendar" size={18} />
                          </span>
                          <div>
                            <h3>{payment.title}</h3>
                            <p>
                              {dateLabel(payment.dueDate)}
                              {payment.recurrence === "monthly"
                                ? " · Mensual"
                                : ""}
                            </p>
                          </div>
                          <span
                            className={`due-badge ${days < 0 ? "overdue" : days <= payment.reminderDays ? "soon" : ""}`}
                          >
                            {days < 0
                              ? `Vencida ${Math.abs(days)}d`
                              : days === 0
                                ? "Vence hoy"
                                : `En ${days} días`}
                          </span>
                        </div>
                        <strong className="debt-card-amount">
                          {formatCOP(payment.amount)}
                        </strong>
                        {reminderTask && (
                          <div className="debt-reminder-alert">
                            <Icon name="bell" size={15} />
                            {reminderTask.text}
                          </div>
                        )}
                        <div className="debt-checklist-block">
                          <div className="debt-checklist-title">
                            <strong>Checklist</strong>
                            <span>
                              {
                                payment.checklist.filter((task) => task.done)
                                  .length
                              }
                              /{payment.checklist.length}
                            </span>
                          </div>
                          {payment.checklist.length ? (
                            payment.checklist.map((task) => (
                              <label
                                className={`checklist-item ${task.done ? "checked" : ""}`}
                                key={task.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={task.done}
                                  onChange={() =>
                                    void toggleChecklistItem(payment, task.id)
                                  }
                                />
                                <span>{task.text}</span>
                              </label>
                            ))
                          ) : (
                            <p className="debt-no-tasks">
                              El aviso se agregará aquí al acercarse el
                              vencimiento.
                            </p>
                          )}
                        </div>
                        <div className="debt-card-actions">
                          <button
                            className="secondary-button debt-delete-button"
                            onClick={() => void removeScheduledPayment(payment)}
                          >
                            Eliminar
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() => openDebtEditor(payment)}
                          >
                            <Icon name="edit" size={14} /> Editar
                          </button>
                          <button
                            className="primary-button"
                            onClick={() => void markPaymentPaid(payment)}
                          >
                            Marcar pagada
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <section className="panel empty-state debt-empty">
                  <span className="empty-icon">
                    <Icon name="debt" size={25} />
                  </span>
                  <h2>No tienes deudas pendientes</h2>
                  <p>
                    Registra lo que debes pagar. Configura la fecha y los días
                    de aviso para recibir un recordatorio y verlo en tu
                    checklist.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => openDebtEditor()}
                  >
                    <Icon name="plus" size={17} /> Registrar primera deuda
                  </button>
                </section>
              )}
              {payments.some((payment) => payment.paid) && (
                <section className="panel debt-paid-summary">
                  <h3>Pagadas recientemente</h3>
                  {payments
                    .filter((payment) => payment.paid)
                    .slice(0, 5)
                    .map((payment) => (
                      <div className="debt-paid-row" key={payment.id}>
                        <span>✓</span>
                        <strong>{payment.title}</strong>
                        <small>{dateLabel(payment.dueDate)}</small>
                        <b>{formatCOP(payment.amount)}</b>
                      </div>
                    ))}
                </section>
              )}
            </section>
          )}
          {view === "Presupuestos" && (
            <section className="panel budget-page">
              <div className="panel-heading">
                <div>
                  <h2>Presupuestos de {monthLabel}</h2>
                  <p>Controla tus gastos por categoría</p>
                </div>
                <button
                  className="primary-button"
                  onClick={() =>
                    setNotice(
                      "La creación de presupuestos estará disponible próximamente",
                    )
                  }
                >
                  <Icon name="plus" size={17} /> Crear presupuesto
                </button>
              </div>
              {budgets.length === 0 && (
                <p className="empty-hint">Aún no has creado presupuestos.</p>
              )}
              {budgets.map((budget) => (
                <div className="budget-page-row" key={budget.name}>
                  <div className="budget-info">
                    <span className={`budget-emoji ${budget.color}`}>
                      {budget.icon}
                    </span>
                    <div className="budget-name">
                      <strong>{budget.name}</strong>
                      <span>
                        {formatCOP(budget.spent)} de {formatCOP(budget.limit)}
                      </span>
                    </div>
                    <span className="budget-percent">
                      {Math.round((budget.spent / budget.limit) * 100)}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className={`progress-fill ${budget.color}`}
                      style={{
                        width: `${(budget.spent / budget.limit) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </section>
          )}

          <footer className="page-footer">
            <span>
              <i /> Se guardan en PostgreSQL y quedan disponibles localmente sin
              conexión
            </span>
            <span>Contavid · Finanzas en modo seguro</span>
          </footer>
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Navegación móvil">
        {nav.map((item) => (
          <button
            key={item.label}
            className={view === item.label ? "selected" : ""}
            onClick={() => setView(item.label)}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label === "Movimientos" ? "Movim." : item.label}</span>
          </button>
        ))}
      </nav>

      {incomeEditorOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setIncomeEditorOpen(false);
          }}
        >
          <section
            className="movement-modal income-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="income-editor-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">{monthLabel.toUpperCase()}</span>
                <h2 id="income-editor-title">Editar ingresos</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setIncomeEditorOpen(false)}
                aria-label="Cerrar"
              >
                <Icon name="close" />
              </button>
            </div>
            <p className="income-goal-explainer">
              Elige un ingreso para corregir su descripción, valor o fecha. El
              total del mes se actualizará automáticamente.
            </p>
            {monthIncomeMovements.length === 0 ? (
              <div className="income-editor-empty">
                <p>No tienes ingresos registrados este mes.</p>
                <button className="primary-button" onClick={startIncomeEntry}>
                  <Icon name="plus" size={16} /> Registrar ingreso
                </button>
              </div>
            ) : (
              <div className="income-editor-list">
                {monthIncomeMovements.map((movement) => (
                  <div className="income-editor-row" key={movement.id}>
                    <span className="income-editor-icon">↙</span>
                    <div className="income-editor-details">
                      <strong>{movement.title}</strong>
                      <small>
                        {dateLabel(movement.date)} · {movement.category}
                      </small>
                    </div>
                    <strong className="income-editor-amount">
                      {formatCOP(movement.amount)}
                    </strong>
                    <button
                      className="secondary-button income-editor-action"
                      onClick={() => editIncome(movement)}
                    >
                      Editar
                    </button>
                  </div>
                ))}
              </div>
            )}
            {monthIncomeMovements.length > 0 && (
              <div className="income-editor-footer">
                <span>
                  Total del mes <strong>{formatCOP(totals.income)}</strong>
                </span>
                <button className="primary-button" onClick={startIncomeEntry}>
                  <Icon name="plus" size={16} /> Añadir ingreso
                </button>
              </div>
            )}
          </section>
        </div>
      )}
      {modalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModalOpen(false);
              setEditingMovementId(null);
            }
          }}
        >
          <section
            className="movement-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  {editingMovementId
                    ? "ACTUALIZACIÓN DE INGRESO"
                    : "REGISTRO FINANCIERO"}
                </span>
                <h2 id="modal-title">
                  {editingMovementId ? "Editar ingreso" : "Nuevo movimiento"}
                </h2>
              </div>
              <button
                className="icon-button"
                onClick={() => {
                  setModalOpen(false);
                  setEditingMovementId(null);
                }}
                aria-label="Cerrar"
              >
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={addMovement}>
              <label>
                Tipo de movimiento
                <select
                  value={form.kind}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      kind: event.target.value as Movement["kind"],
                      account: "Efectivo",
                    })
                  }
                >
                  <option value="expense">Gasto</option>
                  <option value="income">Ingreso</option>
                </select>
              </label>
              <label>
                Descripción
                <input
                  autoFocus
                  required
                  placeholder="Ej. Mercado, salario..."
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                />
              </label>
              <div className="form-two">
                <label>
                  Valor en COP
                  <input
                    required
                    min="1"
                    step="1"
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={form.amount}
                    onChange={(event) =>
                      setForm({ ...form, amount: event.target.value })
                    }
                  />
                </label>
                <label>
                  Fecha
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      setForm({ ...form, date: event.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                Categoría
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                >
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingMovementId(null);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-button">
                  {editingMovementId ? "Guardar cambios" : "Guardar movimiento"}
                </button>
              </div>
              <p className="local-note">
                <Icon name="shield" size={14} /> Se guarda en PostgreSQL y queda
                una copia local para usarlo sin conexión.
              </p>
            </form>
          </section>
        </div>
      )}
      {incomeGoalModalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setIncomeGoalModalOpen(false);
          }}
        >
          <section
            className="movement-modal income-goal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="income-goal-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">PRESUPUESTO DEL MES</span>
                <h2 id="income-goal-title">Meta de ingresos</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setIncomeGoalModalOpen(false)}
                aria-label="Cerrar"
              >
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={saveIncomeGoal}>
              <p className="income-goal-explainer">
                Define cuánto esperas recibir este mes. Esto sirve para planear
                tu presupuesto y no modifica los movimientos reales.
              </p>
              <label>
                Meta mensual en COP
                <input
                  autoFocus
                  required
                  min="1"
                  step="1"
                  type="number"
                  inputMode="numeric"
                  placeholder="Ej. 3.500.000"
                  value={incomeGoalDraft}
                  onChange={(event) => setIncomeGoalDraft(event.target.value)}
                />
              </label>
              <div className="modal-actions income-goal-actions">
                {incomeGoal !== null && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={clearIncomeGoal}
                  >
                    Quitar meta
                  </button>
                )}
                <span />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIncomeGoalModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-button">
                  Guardar meta
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {paymentModalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPaymentModalOpen(false);
              setEditingPaymentId(null);
            }
          }}
        >
          <section
            className="movement-modal payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">PLAN DE PAGOS</span>
                <h2 id="payment-modal-title">
                  {editingPaymentId ? "Editar deuda" : "Registrar deuda"}
                </h2>
              </div>
              <button
                className="icon-button"
                onClick={() => {
                  setPaymentModalOpen(false);
                  setEditingPaymentId(null);
                }}
                aria-label="Cerrar"
              >
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={(event) => void addScheduledPayment(event)}>
              <label>
                ¿Qué debes pagar?
                <input
                  autoFocus
                  required
                  maxLength={120}
                  placeholder="Ej. Cuota del crédito, internet…"
                  value={paymentForm.title}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      title: event.target.value,
                    })
                  }
                />
              </label>
              <div className="form-two">
                <label>
                  Valor en COP
                  <input
                    required
                    min="1"
                    step="1"
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={paymentForm.amount}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        amount: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Fecha límite
                  <input
                    required
                    type="date"
                    value={paymentForm.dueDate}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        dueDate: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="form-two">
                <label>
                  Recordarme
                  <select
                    value={paymentForm.reminderDays}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        reminderDays: event.target.value,
                      })
                    }
                  >
                    <option value="0">El mismo día</option>
                    <option value="1">1 día antes</option>
                    <option value="3">3 días antes</option>
                    <option value="7">1 semana antes</option>
                    <option value="14">2 semanas antes</option>
                  </select>
                </label>
                <label>
                  Frecuencia
                  <select
                    value={paymentForm.recurrence}
                    onChange={(event) =>
                      setPaymentForm({
                        ...paymentForm,
                        recurrence: event.target.value as "none" | "monthly",
                      })
                    }
                  >
                    <option value="none">Una sola vez</option>
                    <option value="monthly">Cada mes</option>
                  </select>
                </label>
              </div>
              <label>
                Lista de tareas <small>Una tarea por línea (opcional)</small>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder={
                    "Ej.\nConfirmar el valor\nRealizar transferencia"
                  }
                  value={paymentForm.checklist}
                  onChange={(event) =>
                    setPaymentForm({
                      ...paymentForm,
                      checklist: event.target.value,
                    })
                  }
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-button">
                  <Icon name="bell" size={16} />{" "}
                  {editingPaymentId ? "Guardar cambios" : "Guardar deuda"}
                </button>
              </div>
              <p className="local-note">
                <Icon name="shield" size={14} />{" "}
                {pushEnabled
                  ? "Notificaciones push activadas para tus vencimientos."
                  : "Activa los avisos para recibir notificaciones antes del vencimiento."}
              </p>
            </form>
          </section>
        </div>
      )}
      {savingsModalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setSavingsModalOpen(false);
          }}
        >
          <section
            className="movement-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="savings-modal-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">ALCANCÍA DIGITAL</span>
                <h2 id="savings-modal-title">
                  {savingsForm.kind === "deposit"
                    ? "Registrar ahorro"
                    : "Registrar retiro"}
                </h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setSavingsModalOpen(false)}
                aria-label="Cerrar"
              >
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={(event) => void addSavings(event)}>
              <label>
                Movimiento
                <select
                  value={savingsForm.kind}
                  onChange={(event) =>
                    setSavingsForm({
                      ...savingsForm,
                      kind: event.target.value as "deposit" | "withdrawal",
                    })
                  }
                >
                  <option value="deposit">Aporte a mis ahorros</option>
                  <option value="withdrawal">Retiro de mis ahorros</option>
                </select>
              </label>
              <label>
                Descripción
                <input
                  required
                  maxLength={120}
                  placeholder="Ej. Ahorro quincenal"
                  value={savingsForm.title}
                  onChange={(event) =>
                    setSavingsForm({
                      ...savingsForm,
                      title: event.target.value,
                    })
                  }
                />
              </label>
              <div className="form-two">
                <label>
                  Valor en COP
                  <input
                    required
                    min="1"
                    step="1"
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={savingsForm.amount}
                    onChange={(event) =>
                      setSavingsForm({
                        ...savingsForm,
                        amount: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Fecha
                  <input
                    required
                    type="date"
                    value={savingsForm.date}
                    onChange={(event) =>
                      setSavingsForm({
                        ...savingsForm,
                        date: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSavingsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="primary-button">
                  Guardar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
    </div>
  );
}

function AuthScreen({
  mode,
  theme,
  onToggleTheme,
  onAuthenticated,
}: {
  mode: "setup" | "login";
  theme: Theme;
  onToggleTheme: () => void;
  onAuthenticated: (username: string) => void;
}) {
  const isSetup = mode === "setup";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isSetup && password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(
        isSetup ? "/api/auth/setup" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        },
      );
      const result = (await response.json()) as {
        username?: string;
        error?: string;
      };
      if (!response.ok || !result.username)
        throw new Error(result.error || "No fue posible iniciar sesión.");
      onAuthenticated(result.username);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No hay conexión con PostgreSQL.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <button
          className="theme-toggle auth-theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Cambiar a modo ${theme === "dark" ? "claro" : "noche"}`}
          title={`Cambiar a modo ${theme === "dark" ? "claro" : "noche"}`}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
          <span>{theme === "dark" ? "Claro" : "Noche"}</span>
        </button>
        <div className="auth-brand">
          <span className="brand-mark">
            <img src="/contavid-icon.png" alt="" />
          </span>
          <span>
            Contavid<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="eyebrow">FINANZAS PERSONALES · COP</div>
        <h1>{isSetup ? "Crea tu acceso" : "Qué bueno verte"}</h1>
        <p className="auth-description">
          {isSetup
            ? "Configura tu usuario y una contraseña para proteger tus datos."
            : "Inicia sesión para ver y organizar tus movimientos."}
        </p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Usuario
            <input
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9._-]+"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Tu usuario"
            />
            {isSetup && (
              <small>
                3–32 caracteres; letras, números, punto, guion o guion bajo.
              </small>
            )}
          </label>
          <label>
            Contraseña
            <input
              autoComplete={isSetup ? "new-password" : "current-password"}
              required
              minLength={isSetup ? 12 : 1}
              maxLength={200}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isSetup ? "Mínimo 12 caracteres" : "Tu contraseña"}
            />
          </label>
          {isSetup && (
            <label>
              Confirma la contraseña
              <input
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={200}
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Escríbela de nuevo"
              />
            </label>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button auth-submit"
            disabled={busy}
            type="submit"
          >
            {busy ? "Un momento…" : isSetup ? "Crear cuenta" : "Iniciar sesión"}
          </button>
        </form>
        <p className="auth-security">
          <Icon name="shield" size={15} /> La contraseña se guarda cifrada como
          hash en PostgreSQL; nunca se muestra de nuevo.
        </p>
      </section>
    </main>
  );
}

function MovementTable({
  movements,
  onDelete,
}: {
  movements: Movement[];
  onDelete: (id: string) => void;
}) {
  if (movements.length === 0)
    return (
      <div className="no-results">
        Aún no hay movimientos registrados. Cuando agregues uno, aparecerá aquí.
      </div>
    );
  return (
    <div className="table-wrap">
      <table className="movement-table">
        <thead>
          <tr>
            <th>MOVIMIENTO</th>
            <th>CATEGORÍA</th>
            <th>FECHA</th>
            <th>CUENTA</th>
            <th className="amount-head">VALOR</th>
            <th>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => {
            const positive = movement.kind === "income";
            const label =
              movement.kind === "card"
                ? "Compra tarjeta"
                : movement.kind === "payment"
                  ? "Abono tarjeta"
                  : movement.kind === "income"
                    ? "Ingreso"
                    : "Gasto";
            return (
              <tr key={movement.id}>
                <td>
                  <span
                    className={`movement-symbol ${positive ? "income-symbol" : movement.kind === "payment" ? "payment-symbol" : ""}`}
                  >
                    {positive
                      ? "↙"
                      : movement.kind === "payment"
                        ? "↗"
                        : movement.kind === "card"
                          ? "▣"
                          : "↗"}
                  </span>
                  <span className="movement-title">
                    <strong>{movement.title}</strong>
                    <small>{label}</small>
                  </span>
                </td>
                <td>
                  <span className="category-pill">{movement.category}</span>
                </td>
                <td className="date-cell">
                  {new Intl.DateTimeFormat("es-CO", {
                    day: "numeric",
                    month: "short",
                  }).format(new Date(`${movement.date}T12:00:00`))}
                </td>
                <td className="account-cell">{movement.account}</td>
                <td
                  className={`amount-cell ${positive ? "positive-amount" : ""}`}
                >
                  {positive ? "+" : "−"}
                  {formatCOP(movement.amount)}
                </td>
                <td>
                  <button
                    className="row-action"
                    aria-label={`Eliminar ${movement.title}`}
                    onClick={() => {
                      if (window.confirm(`¿Eliminar “${movement.title}”?`))
                        onDelete(movement.id);
                    }}
                  >
                    <Icon name="more" size={17} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default App;
