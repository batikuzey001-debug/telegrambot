import express from "express";
import pkg from "pg";
import fetch from "node-fetch";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

const app = express();
app.use(express.json());

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const BOT_INVALIDATE_URL = process.env.BOT_INVALIDATE_URL || "";
const CACHE_SECRET = process.env.CACHE_SECRET || "";

async function initDb() {
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
      image_url TEXT,
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
      ('events', 'Güncel etkinlik bulunamadı.')
    ON CONFLICT (key) DO NOTHING;
  `);
}

app.get("/", (_req, res) => res.json({ ok: true }));

// Messages
app.get("/messages/:key", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT content, image_url FROM messages WHERE key = $1 AND active = true LIMIT 1",
    [req.params.key]
  );
  if (!rows.length) return res.status(404).json({ error: "not_found" });
  res.json(rows[0]);
});

// Admin update message
app.put("/admin/messages/:key", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { content, image_url } = req.body || {};
  if (!content && !image_url) return res.status(400).json({ error: "no_changes" });

  const q = `
    INSERT INTO messages (key, content, image_url, active)
    VALUES ($1, COALESCE($2, ''), $3, true)
    ON CONFLICT (key) DO UPDATE SET
      content = COALESCE($2, messages.content),
      image_url = COALESCE($3, messages.image_url),
      updated_at = now()
    RETURNING key, content, image_url, updated_at
  `;
  const { rows } = await pool.query(q, [req.params.key, content || null, image_url || null]);

  // Invalidate bot cache
  if (BOT_INVALIDATE_URL && CACHE_SECRET) {
    try {
      await fetch(BOT_INVALIDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cache-secret": CACHE_SECRET },
        body: JSON.stringify({ key: req.params.key })
      });
    } catch {}
  }

  res.json(rows[0]);
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

// Users list
app.get("/users", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, external_id, name, membership_id FROM users ORDER BY id DESC LIMIT 500"
  );
  res.json(rows);
});

const port = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(port, () => console.log(`API on :${port}`)))
  .catch((e) => { console.error("DB init error", e); process.exit(1); });
