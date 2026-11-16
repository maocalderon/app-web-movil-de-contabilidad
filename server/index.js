import express from "express";
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import * as webPush from "web-push";
import { migrate, pool } from "./db.js";

const app = express();
const port = Number(process.env.API_PORT || 3001);
const scrypt = promisify(scryptCallback);
const failedLogins = new Map();
app.use(express.json({ limit: "1mb" }));

function getCookie(request, name) {
  const cookie = request.headers.cookie
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return cookie?.slice(name.length + 1);
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function setSessionCookie(response, token, maxAge = 30 * 24 * 60 * 60) {
  response.setHeader(
    "Set-Cookie",
    `brujula_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}

async function createSession(userId, response) {
  const token = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')",
    [tokenHash(token), userId],
  );
  setSessionCookie(response, token);
}

async function requireAuth(request, response, next) {
  const token = getCookie(request, "brujula_session");
  if (!token)
    return response
      .status(401)
      .json({ error: "Inicia sesión para continuar." });
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.username FROM app_sessions s
       JOIN app_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash(token)],
    );
    if (!rows[0])
      return response
        .status(401)
        .json({ error: "La sesión venció. Inicia sesión otra vez." });
    request.user = rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

app.get("/api/auth/status", async (_request, response, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM app_users) AS configured",
    );
    response.json({ configured: rows[0].configured });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/setup", async (request, response, next) => {
  const username =
    typeof request.body?.username === "string"
      ? request.body.username.trim().toLowerCase()
      : "";
  const password = request.body?.password;
  if (
    !/^[a-z0-9._-]{3,32}$/.test(username) ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 200
  ) {
    return response.status(400).json({
      error:
        "Usa un usuario de 3 a 32 caracteres y una contraseña de al menos 12.",
    });
  }
  try {
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, 64);
    const userId = randomUUID();
    await pool.query(
      "INSERT INTO app_users (id, username, password_salt, password_hash) VALUES ($1, $2, $3, $4)",
      [userId, username, salt.toString("hex"), hash.toString("hex")],
    );
    await createSession(userId, response);
    response.status(201).json({ username });
  } catch (error) {
    if (error.code === "23505")
      return response
        .status(409)
        .json({ error: "La cuenta ya está configurada." });
    next(error);
  }
});

app.post("/api/auth/login", async (request, response, next) => {
  const username =
    typeof request.body?.username === "string"
      ? request.body.username.trim().toLowerCase()
      : "";
  const password = request.body?.password;
  const ip = request.ip;
  const attempts = failedLogins.get(ip) || { count: 0, since: Date.now() };
  if (Date.now() - attempts.since > 10 * 60 * 1000) {
    attempts.count = 0;
    attempts.since = Date.now();
  }
  if (attempts.count >= 8)
    return response
      .status(429)
      .json({ error: "Demasiados intentos. Prueba de nuevo en unos minutos." });
  try {
    const { rows } = await pool.query(
      "SELECT id, username, password_salt, password_hash FROM app_users WHERE username = $1",
      [username],
    );
    const user = rows[0];
    const salt = user
      ? Buffer.from(user.password_salt, "hex")
      : Buffer.alloc(16);
    const expected = user
      ? Buffer.from(user.password_hash, "hex")
      : Buffer.alloc(64);
    const actual = Buffer.from(
      await scrypt(typeof password === "string" ? password : "", salt, 64),
    );
    if (!user || !timingSafeEqual(expected, actual)) {
      attempts.count += 1;
      failedLogins.set(ip, attempts);
      return response
        .status(401)
        .json({ error: "Usuario o contraseña incorrectos." });
    }
    failedLogins.delete(ip);
    await createSession(user.id, response);
    response.json({ username: user.username });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  response.json({ username: request.user.username });
});

app.post("/api/auth/logout", async (request, response, next) => {
  const token = getCookie(request, "brujula_session");
  try {
    if (token)
      await pool.query("DELETE FROM app_sessions WHERE token_hash = $1", [
        tokenHash(token),
      ]);
    setSessionCookie(response, "", 0);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/health", async (_request, response) => {
  try {
    await pool.query("SELECT 1");
    response.json({ ok: true, database: "postgresql" });
  } catch {
    response
      .status(503)
      .json({ ok: false, error: "Base de datos no disponible" });
  }
});

app.get("/api/movements", requireAuth, async (_request, response, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, category, to_char(movement_date, 'YYYY-MM-DD') AS date, amount::text AS amount,
              kind, account, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM movements WHERE deleted_at IS NULL ORDER BY movement_date DESC, created_at DESC`,
    );
    response.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
  } catch (error) {
    next(error);
  }
});

app.put("/api/movements/sync", requireAuth, async (request, response, next) => {
  const movements = request.body?.movements;
  const deletedIds = request.body?.deletedIds || [];
  if (
    !Array.isArray(movements) ||
    movements.length > 5000 ||
    !Array.isArray(deletedIds) ||
    deletedIds.length > 5000
  ) {
    return response
      .status(400)
      .json({ error: "La lista de movimientos no es válida." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const movement of movements) {
      const amount = Number(movement.amount);
      if (
        typeof movement.id !== "string" ||
        typeof movement.title !== "string" ||
        typeof movement.category !== "string" ||
        typeof movement.account !== "string" ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        !["income", "expense", "card", "payment"].includes(movement.kind) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(movement.date)
      ) {
        await client.query("ROLLBACK");
        return response
          .status(400)
          .json({ error: "Hay un movimiento con datos inválidos." });
      }

      await client.query(
        `INSERT INTO movements (id, title, category, movement_date, amount, kind, account, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()), COALESCE($9::timestamptz, now()))
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           category = EXCLUDED.category,
           movement_date = EXCLUDED.movement_date,
           amount = EXCLUDED.amount,
           kind = EXCLUDED.kind,
           account = EXCLUDED.account,
           updated_at = EXCLUDED.updated_at,
           deleted_at = NULL
         WHERE movements.updated_at <= EXCLUDED.updated_at`,
        [
          movement.id,
          movement.title.trim(),
          movement.category,
          movement.date,
          amount,
          movement.kind,
          movement.account,
          movement.createdAt || null,
          movement.updatedAt || null,
        ],
      );
    }
    for (const id of deletedIds) {
      if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
        await client.query("ROLLBACK");
        return response
          .status(400)
          .json({ error: "Hay un identificador eliminado inválido." });
      }
      await client.query(
        "UPDATE movements SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL",
        [id],
      );
    }
    await client.query("COMMIT");
    const { rows } = await pool.query(
      `SELECT id, title, category, to_char(movement_date, 'YYYY-MM-DD') AS date, amount::text AS amount,
              kind, account, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM movements WHERE deleted_at IS NULL ORDER BY movement_date DESC, created_at DESC`,
    );
    response.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

function validChecklist(value) {
  return (
    Array.isArray(value) &&
    value.length <= 20 &&
    value.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.text === "string" &&
        item.text.trim().length > 0 &&
        item.text.length <= 100 &&
        typeof item.done === "boolean",
    )
  );
}

function nextMonthlyDate(isoDate) {
  const current = new Date(`${isoDate}T12:00:00Z`);
  const day = current.getUTCDate();
  current.setUTCDate(1);
  current.setUTCMonth(current.getUTCMonth() + 1);
  const lastDay = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0),
  ).getUTCDate();
  current.setUTCDate(Math.min(day, lastDay));
  return current.toISOString().slice(0, 10);
}

function todayBogota() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysBetweenDates(laterDate, earlierDate) {
  return Math.round(
    (new Date(`${laterDate}T12:00:00Z`).getTime() -
      new Date(`${earlierDate}T12:00:00Z`).getTime()) /
      86_400_000,
  );
}

app.get("/api/payments", requireAuth, async (_request, response, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, amount::text AS amount,
              to_char(due_date, 'YYYY-MM-DD') AS "dueDate",
              reminder_days AS "reminderDays", recurrence, paid, checklist,
              created_at AS "createdAt"
       FROM scheduled_payments ORDER BY paid ASC, due_date ASC, created_at DESC`,
    );
    response.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments", requireAuth, async (request, response, next) => {
  const {
    title,
    dueDate,
    recurrence = "none",
    checklist = [],
  } = request.body || {};
  const amount = Number(request.body?.amount);
  const reminderDays = Number(request.body?.reminderDays ?? 1);
  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 120 ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDate || "") ||
    !Number.isInteger(reminderDays) ||
    reminderDays < 0 ||
    reminderDays > 30 ||
    !["none", "monthly"].includes(recurrence) ||
    !validChecklist(checklist)
  ) {
    return response.status(400).json({ error: "Revisa los datos del pago." });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO scheduled_payments
       (id, title, amount, due_date, reminder_days, recurrence, checklist)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, title, amount::text AS amount,
                 to_char(due_date, 'YYYY-MM-DD') AS "dueDate",
                 reminder_days AS "reminderDays", recurrence, paid, checklist,
                 created_at AS "createdAt"`,
      [
        randomUUID(),
        title.trim(),
        amount,
        dueDate,
        reminderDays,
        recurrence,
        JSON.stringify(checklist),
      ],
    );
    response.status(201).json({ ...rows[0], amount: Number(rows[0].amount) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/payments/:id", requireAuth, async (request, response, next) => {
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id))
    return response.status(400).json({ error: "Identificador inválido." });
  const hasPaid = Object.hasOwn(request.body || {}, "paid");
  const hasChecklist = Object.hasOwn(request.body || {}, "checklist");
  const hasDetails = [
    "title",
    "amount",
    "dueDate",
    "reminderDays",
    "recurrence",
  ].some((key) => Object.hasOwn(request.body || {}, key));
  const { title, dueDate, recurrence } = request.body || {};
  const amount = Number(request.body?.amount);
  const reminderDays = Number(request.body?.reminderDays);
  if (
    (!hasPaid && !hasChecklist && !hasDetails) ||
    (hasPaid && typeof request.body.paid !== "boolean") ||
    (hasChecklist && !validChecklist(request.body.checklist)) ||
    (hasDetails &&
      (typeof title !== "string" ||
        !title.trim() ||
        title.length > 120 ||
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dueDate || "") ||
        !Number.isInteger(reminderDays) ||
        reminderDays < 0 ||
        reminderDays > 30 ||
        !["none", "monthly"].includes(recurrence)))
  ) {
    return response
      .status(400)
      .json({ error: "La actualización no es válida." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT id, title, amount, due_date, reminder_days, recurrence, paid, checklist
       FROM scheduled_payments WHERE id = $1 FOR UPDATE`,
      [request.params.id],
    );
    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      return response.status(404).json({ error: "No encontramos ese pago." });
    }
    const payment = existing.rows[0];
    const paid = hasPaid ? request.body.paid : payment.paid;
    const checklist = hasChecklist ? request.body.checklist : payment.checklist;
    const nextTitle = hasDetails ? title.trim() : payment.title;
    const nextAmount = hasDetails ? amount : payment.amount;
    const nextDueDate = hasDetails ? dueDate : payment.due_date;
    const nextReminderDays = hasDetails ? reminderDays : payment.reminder_days;
    const nextRecurrence = hasDetails ? recurrence : payment.recurrence;
    await client.query(
      `UPDATE scheduled_payments SET title = $2, amount = $3, due_date = $4,
       reminder_days = $5, recurrence = $6, paid = $7, checklist = $8::jsonb, updated_at = now()
       WHERE id = $1`,
      [
        request.params.id,
        nextTitle,
        nextAmount,
        nextDueDate,
        nextReminderDays,
        nextRecurrence,
        paid,
        JSON.stringify(checklist),
      ],
    );
    let nextPayment = null;
    if (!payment.paid && paid && nextRecurrence === "monthly") {
      const dueDate =
        payment.due_date instanceof Date
          ? payment.due_date.toISOString().slice(0, 10)
          : String(payment.due_date).slice(0, 10);
      const { rows } = await client.query(
        `INSERT INTO scheduled_payments
         (id, title, amount, due_date, reminder_days, recurrence, checklist)
         VALUES ($1, $2, $3, $4, $5, 'monthly', $6::jsonb)
         RETURNING id, title, amount::text AS amount,
                   to_char(due_date, 'YYYY-MM-DD') AS "dueDate",
                   reminder_days AS "reminderDays", recurrence, paid, checklist,
                   created_at AS "createdAt"`,
        [
          randomUUID(),
          nextTitle,
          nextAmount,
          nextMonthlyDate(dueDate),
          nextReminderDays,
          JSON.stringify(checklist.map((item) => ({ ...item, done: false }))),
        ],
      );
      nextPayment = { ...rows[0], amount: Number(rows[0].amount) };
    }
    await client.query("COMMIT");
    response.json({ ok: true, nextPayment });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

app.delete(
  "/api/payments/:id",
  requireAuth,
  async (request, response, next) => {
    if (!/^[0-9a-f-]{36}$/i.test(request.params.id))
      return response.status(400).json({ error: "Identificador inválido." });
    try {
      const result = await pool.query(
        "DELETE FROM scheduled_payments WHERE id = $1",
        [request.params.id],
      );
      if (!result.rowCount)
        return response.status(404).json({ error: "No encontramos ese pago." });
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/savings", requireAuth, async (_request, response, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, amount::text AS amount,
              to_char(entry_date, 'YYYY-MM-DD') AS date, kind,
              created_at AS "createdAt"
       FROM savings_entries ORDER BY entry_date DESC, created_at DESC`,
    );
    response.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
  } catch (error) {
    next(error);
  }
});

app.post("/api/savings", requireAuth, async (request, response, next) => {
  const { title, date, kind } = request.body || {};
  const amount = Number(request.body?.amount);
  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 120 ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date || "") ||
    !["deposit", "withdrawal"].includes(kind)
  ) {
    return response.status(400).json({ error: "Revisa los datos del ahorro." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "LOCK TABLE savings_entries IN SHARE ROW EXCLUSIVE MODE",
    );
    const { rows: totals } = await client.query(
      `SELECT COALESCE(SUM(CASE WHEN kind = 'deposit' THEN amount ELSE -amount END), 0)::text AS balance
       FROM savings_entries`,
    );
    if (kind === "withdrawal" && amount > Number(totals[0].balance)) {
      await client.query("ROLLBACK");
      return response
        .status(400)
        .json({ error: "Ese retiro supera lo que llevas ahorrado." });
    }
    const { rows } = await client.query(
      `INSERT INTO savings_entries (id, title, amount, entry_date, kind)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, amount::text AS amount,
                 to_char(entry_date, 'YYYY-MM-DD') AS date, kind,
                 created_at AS "createdAt"`,
      [randomUUID(), title.trim(), amount, date, kind],
    );
    await client.query("COMMIT");
    response.status(201).json({ ...rows[0], amount: Number(rows[0].amount) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

app.delete("/api/savings/:id", requireAuth, async (request, response, next) => {
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id))
    return response.status(400).json({ error: "Identificador inválido." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "LOCK TABLE savings_entries IN SHARE ROW EXCLUSIVE MODE",
    );
    const existing = await client.query(
      "SELECT id, kind, amount FROM savings_entries WHERE id = $1 FOR UPDATE",
      [request.params.id],
    );
    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      return response.status(404).json({ error: "No encontramos ese ahorro." });
    }
    const entry = existing.rows[0];
    if (entry.kind === "deposit") {
      const { rows } = await client.query(
        `SELECT COALESCE(SUM(CASE WHEN kind = 'deposit' THEN amount ELSE -amount END), 0)::text AS balance
         FROM savings_entries WHERE id <> $1`,
        [request.params.id],
      );
      if (Number(rows[0].balance) < 0) {
        await client.query("ROLLBACK");
        return response.status(409).json({
          error:
            "No se puede eliminar: los retiros registrados superarían el ahorro disponible.",
        });
      }
    }
    await client.query("DELETE FROM savings_entries WHERE id = $1", [
      request.params.id,
    ]);
    await client.query("COMMIT");
    response.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

app.get("/api/push/public-key", (_request, response) => {
  if (!process.env.VAPID_PUBLIC_KEY)
    return response
      .status(503)
      .json({ error: "Los avisos push aún no están configurados." });
  response.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.post(
  "/api/push/subscribe",
  requireAuth,
  async (request, response, next) => {
    const subscription = request.body;
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (
      typeof endpoint !== "string" ||
      !endpoint.startsWith("https://") ||
      endpoint.length > 2000 ||
      typeof p256dh !== "string" ||
      typeof auth !== "string"
    ) {
      return response
        .status(400)
        .json({ error: "La suscripción de notificaciones no es válida." });
    }
    try {
      await pool.query(
        `INSERT INTO push_subscriptions (id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
        [randomUUID(), endpoint, p256dh, auth],
      );
      response.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  "/api/push/subscribe",
  requireAuth,
  async (request, response, next) => {
    const endpoint = request.body?.endpoint;
    if (typeof endpoint !== "string")
      return response
        .status(400)
        .json({ error: "Falta el endpoint de la suscripción." });
    try {
      await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [
        endpoint,
      ]);
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/cron/reminders", async (request, response, next) => {
  const expected = process.env.CRON_SECRET;
  if (!expected)
    return response
      .status(503)
      .json({ error: "El envío de recordatorios no está configurado." });
  if (request.get("authorization") !== `Bearer ${expected}`)
    return response.status(401).json({ error: "No autorizado." });
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)
    return response
      .status(503)
      .json({ error: "Faltan las claves de notificaciones." });

  try {
    webPush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:contavid@localhost",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    const [paymentsResult, subscriptionsResult] = await Promise.all([
      pool.query(
        `SELECT id, title, amount::text AS amount,
                to_char(due_date, 'YYYY-MM-DD') AS "dueDate"
         FROM scheduled_payments
         WHERE paid = false
           AND due_date = (now() AT TIME ZONE 'America/Bogota')::date + reminder_days`,
      ),
      pool.query("SELECT endpoint, p256dh, auth FROM push_subscriptions"),
    ]);
    let sent = 0;
    let skipped = 0;
    for (const payment of paymentsResult.rows) {
      for (const subscription of subscriptionsResult.rows) {
        const logged = await pool.query(
          `INSERT INTO push_delivery_log (payment_id, reminder_date, endpoint)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING payment_id`,
          [payment.id, payment.dueDate, subscription.endpoint],
        );
        if (!logged.rowCount) {
          skipped += 1;
          continue;
        }
        const days = Math.max(
          0,
          daysBetweenDates(payment.dueDate, todayBogota()),
        );
        const payload = JSON.stringify({
          title: `Recordatorio de pago · ${payment.title}`,
          body: `${days === 0 ? "Vence hoy" : `Vence en ${days} día${days === 1 ? "" : "s"}`} · ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(payment.amount))}`,
          url: "/?view=Pagos",
          tag: `contavid-payment-${payment.id}`,
        });
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
            { TTL: 60 * 60 * 12 },
          );
          sent += 1;
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await pool.query(
              "DELETE FROM push_subscriptions WHERE endpoint = $1",
              [subscription.endpoint],
            );
          } else {
            await pool.query(
              "DELETE FROM push_delivery_log WHERE payment_id = $1 AND reminder_date = $2 AND endpoint = $3",
              [payment.id, payment.dueDate, subscription.endpoint],
            );
          }
        }
      }
    }
    response.json({ ok: true, sent, skipped });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error("API error:", error.message);
  response.status(500).json({ error: "No se pudo completar la operación." });
});

export { app };

if (process.env.VERCEL !== "1") {
  await migrate();
  app.listen(port, "127.0.0.1", () => {
    console.log(`API Brújula lista en http://127.0.0.1:${port}`);
  });
}
