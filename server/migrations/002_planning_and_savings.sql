CREATE TABLE IF NOT EXISTS scheduled_payments (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  amount BIGINT NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  reminder_days SMALLINT NOT NULL DEFAULT 1 CHECK (reminder_days BETWEEN 0 AND 30),
  recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'monthly')),
  paid BOOLEAN NOT NULL DEFAULT false,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(checklist) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_payments_due_idx
  ON scheduled_payments (due_date) WHERE paid = false;

CREATE TABLE IF NOT EXISTS savings_entries (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  amount BIGINT NOT NULL CHECK (amount > 0),
  entry_date DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('deposit', 'withdrawal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS savings_entries_date_idx
  ON savings_entries (entry_date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_delivery_log (
  payment_id UUID NOT NULL REFERENCES scheduled_payments(id) ON DELETE CASCADE,
  reminder_date DATE NOT NULL,
  endpoint TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (payment_id, reminder_date, endpoint)
);

INSERT INTO schema_migrations (version) VALUES ('002_planning_and_savings') ON CONFLICT DO NOTHING;
