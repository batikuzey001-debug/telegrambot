import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

async function initDb() {
  // Neden: Railway'de migration koşmadan ayakta kalkabilsin.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      external_id TEXT UNIQUE NOT NULL,
      name TEXT,
      membership_id TEXT,
      preferences JSONB DEFAULT '{}'::jsonb,
      bonus JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS menu_options (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      action TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'guest',   -- 'member' | 'guest'
      order_index INT NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id),
      action TEXT NOT NULL,
      meta JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    INSERT INTO messages (key, content) VALUES
      ('welcome', 'Merhaba, hoş geldiniz!'),
      ('not_member', 'Devam için resmi kanala katılın.'),
      ('default', 'Anlayamadım, menüden seçin.')
    ON CONFLICT (key) DO NOTHING;

    INSERT INTO menu_options (title, action, role, order_index) VALUES
      ('Hesap Bilgilerimi Güncelle', 'update_account', 'member', 1),
      ('Ücretsiz Etkinlikler ve Bonuslar', 'free_events', 'member', 2),
      ('Bana Özel Etkinlikler ve Fırsatlar', 'personal_offers', 'member', 3),

      ('RadissonBet üyesi olmak istiyorum', 'become_member', 'guest', 1),
      ('RadissonBet ayrıcalıkları', 'benefits', 'guest', 2),
      ('Etkinlikler ve fırsatlar', 'public_events', 'guest', 3)
    ON CONFLICT DO NOTHING;
  `);
}

const app = express();
app.use(express.json());

app.get("/", (_req, res) => res.json({ ok: true }));

// Messages
app.get("/messages/:key", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT content FROM messages WHERE key = $1 AND active = true LIMIT 1",
    [req.params.key]
  );
  if (!rows.length) return res.status(404).json({ error: "not_found" });
  res.json({ key: req.params.key, content: rows[0].content });
});

// Menu by role
app.get("/menu", async (req, res) => {
  const role = (req.query.role || "guest").toString();
  const { rows } = await pool.query(
    "SELECT title, action FROM menu_options WHERE active = true AND role = $1 ORDER BY order_index ASC",
    [role]
  );
  res.json(rows);
});

// Users upsert
app.post("/users", async (req, res) => {
  const { external_id, name, membership_id } = req.body || {};
  if (!external_id) return res.status(400).json({ error: "external_id required" });

  const q = `
    INSERT INTO users (external_id, name, membership_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (external_id)
    DO UPDATE SET name = EXCLUDED.name,
                  membership_id = EXCLUDED.membership_id,
                  updated_at = now()
    RETURNING id, external_id, name, membership_id
  `;
  const { rows } = await pool.query(q, [external_id, name || null, membership_id || null]);
  res.json(rows[0]);
});

// Audit
app.post("/audit", async (req, res) => {
  const { user_id, action, meta } = req.body || {};
  if (!action) return res.status(400).json({ error: "action required" });
  const { rows } = await pool.query(
    "INSERT INTO audit_logs (user_id, action, meta) VALUES ($1, $2, $3) RETURNING id",
    [user_id || null, action, meta || {}]
  );
  res.json({ id: rows[0].id });
});

const port = process.env.PORT || 3000;
initDb().then(() => {
  app.listen(port, () => console.log(`API on :${port}`));
}).catch((e) => {
  console.error("DB init error", e);
  process.exit(1);
});
