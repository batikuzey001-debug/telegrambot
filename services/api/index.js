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
const BOT_WRITE_SECRET = process.env.BOT_WRITE_SECRET || "";

/* ---------------- DB INIT ---------------- */
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      external_id TEXT UNIQUE NOT NULL,
      name TEXT,
      first_name TEXT,
      last_name  TEXT,
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
  `);

  // idempotent kolon ekleme
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_id TEXT;`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT;`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;`);
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id),
      action TEXT NOT NULL,
      meta JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS members (
      membership_id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name  TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_membership_id ON members (membership_id);

    CREATE TABLE IF NOT EXISTS pending_verifications (
      id BIGSERIAL PRIMARY KEY,
      external_id TEXT NOT NULL,
      provided_membership_id TEXT,
      full_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_verifications (status);
    CREATE INDEX IF NOT EXISTS idx_pending_external ON pending_verifications (external_id);

    CREATE TABLE IF NOT EXISTS raffles (
      key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS raffle_entries (
      id BIGSERIAL PRIMARY KEY,
      raffle_key TEXT NOT NULL REFERENCES raffles(key) ON DELETE CASCADE,
      external_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (raffle_key, external_id)
    );

    -- Bildirim şablonları (planlı gönderim için)
    CREATE TABLE IF NOT EXISTS notification_templates (
      id BIGSERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      buttons JSONB DEFAULT '[]'::jsonb,  -- [{text, url}] opsiyonel
      active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    INSERT INTO messages (key, content) VALUES
      ('welcome','Merhaba, hoş geldiniz!'),
      ('not_member','Devam için resmi kanala katılın.'),
      ('events','Güncel etkinlik bulunamadı.'),
      ('guest_become_member','Kayıt bağlantısı yakında.'),
      ('guest_benefits','Ayrıcalıklar listesi yakında.'),
      ('member_update_account','Hesap güncelleme yakında.'),
      ('member_free_events','Şu an ücretsiz etkinlik yok.'),
      ('member_personal_offers','Yakında sunulacak.'),
      ('raffle_joined','Çekilişe katılımınız alındı. Bol şans!'),
      ('raffle_already','Zaten bu çekilişe katılmışsınız.')
    ON CONFLICT (key) DO NOTHING;

    INSERT INTO raffles (key, title, active)
    VALUES ('default_raffle','Genel Çekiliş', true)
    ON CONFLICT (key) DO NOTHING;
  `);
}

app.get("/", (_req, res) => res.json({ ok: true }));

/* ---------------- MESSAGES ---------------- */
app.get("/messages/:key", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT content, image_url, file_id FROM messages WHERE key=$1 AND active=true LIMIT 1",
    [req.params.key]
  );
  if (!rows.length) return res.status(404).json({ error: "not_found" });
  res.json(rows[0]);
});

app.get("/admin/messages", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return res.status(401).json({ error: "unauthorized" });
  const { rows } = await pool.query(
    "SELECT key, content, image_url, file_id, updated_at FROM messages WHERE active=true ORDER BY key ASC"
  );
  res.json(rows);
});

app.put("/admin/messages/:key", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return res.status(401).json({ error: "unauthorized" });
  const { content, image_url } = req.body || {};
  if (!content && !image_url) return res.status(400).json({ error: "no_changes" });
  const q = `
    INSERT INTO messages (key, content, image_url, active)
    VALUES ($1, COALESCE($2,''), $3, true)
    ON CONFLICT (key) DO UPDATE SET
      content   = COALESCE($2, messages.content),
      image_url = COALESCE($3, messages.image_url),
      file_id   = CASE WHEN $3 IS NOT NULL AND $3 <> messages.image_url THEN NULL ELSE messages.file_id END,
      updated_at= now()
    RETURNING key, content, image_url, file_id, updated_at
  `;
  const { rows } = await pool.query(q, [req.params.key, content || null, image_url || null]);
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

app.put("/bot/messages/:key/file-id", async (req, res) => {
  if ((req.headers["x-bot-secret"] || "") !== BOT_WRITE_SECRET) return res.status(401).json({ error: "unauthorized" });
  const { file_id } = req.body || {};
  if (!file_id) return res.status(400).json({ error: "file_id_required" });
  const { rows } = await pool.query(
    "UPDATE messages SET file_id=$1, updated_at=now() WHERE key=$2 RETURNING key, file_id",
    [file_id, req.params.key]
  );
  if (!rows.length) return res.status(404).json({ error: "not_found" });
  res.json(rows[0]);
});

/* ---------------- USERS ---------------- */
app.post("/users", async (req, res) => {
  const { external_id, name, first_name, last_name, membership_id } = req.body || {};
  if (!external_id) return res.status(400).json({ error: "external_id required" });
  const q = `
    INSERT INTO users (external_id, name, first_name, last_name, membership_id)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (external_id) DO UPDATE SET
      name=EXCLUDED.name,
      first_name=COALESCE(EXCLUDED.first_name, users.first_name),
      last_name =COALESCE(EXCLUDED.last_name,  users.last_name),
      membership_id=COALESCE(EXCLUDED.membership_id, users.membership_id),
      updated_at=now()
    RETURNING id, external_id, name, first_name, last_name, membership_id
  `;
  const { rows } = await pool.query(q, [external_id, name || null, first_name || null, last_name || null, membership_id || null]);
  res.json(rows[0]);
});

// LIST: status
app.get("/users", async (_req, res) => {
  const q = `
    SELECT
      u.id,
      u.external_id,
      u.name,
      u.first_name,
      u.last_name,
      u.membership_id,
      CASE
        WHEN u.membership_id IS NOT NULL THEN 'member'
        WHEN EXISTS (
          SELECT 1 FROM pending_verifications p
          WHERE p.external_id = u.external_id AND p.status = 'pending'
        ) THEN 'pending'
        ELSE 'guest'
      END AS status
    FROM users u
    ORDER BY u.id DESC
    LIMIT 1000
  `;
  const { rows } = await pool.query(q);
  res.json(rows);
});

/* ---------------- MEMBERS & PENDING ---------------- */
app.get("/members/:membership_id", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT membership_id, first_name, last_name FROM members WHERE membership_id=$1 LIMIT 1",
    [req.params.membership_id]
  );
  if (!rows.length) return res.json({ found: false });
  const m = rows[0];
  res.json({ found: true, membership_id: m.membership_id, first_name: m.first_name, last_name: m.last_name });
});

app.post("/admin/members/import", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return res.status(401).json({ error: "unauthorized" });
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: "empty" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of rows) {
      if (!r.membership_id || !r.first_name || !r.last_name) continue;
      await client.query(
        `INSERT INTO members (membership_id, first_name, last_name)
         VALUES ($1,$2,$3)
         ON CONFLICT (membership_id) DO UPDATE SET
           first_name=EXCLUDED.first_name,
           last_name=EXCLUDED.last_name,
           updated_at=now()`,
        [String(r.membership_id), String(r.first_name), String(r.last_name)]
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true, count: rows.length });
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "import_failed" });
  } finally {
    client.release();
  }
});

app.post("/pending-requests", async (req, res) => {
  const { external_id, provided_membership_id, full_name, notes } = req.body || {};
  if (!external_id || !full_name) return res.status(400).json({ error: "external_id_and_full_name_required" });
  const { rows } = await pool.query(
    `INSERT INTO pending_verifications (external_id, provided_membership_id, full_name, notes)
     VALUES ($1,$2,$3,$4) RETURNING id, status`,
    [String(external_id), provided_membership_id || null, String(full_name), notes || null]
  );
  res.json(rows[0]);
});

app.get("/admin/pending-requests", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return res.status(401).json({ error: "unauthorized" });
  const status = (req.query.status || "pending").toString();
  const { rows } = await pool.query(
    "SELECT id, external_id, provided_membership_id, full_name, status, notes, created_at FROM pending_verifications WHERE status=$1 ORDER BY id DESC",
    [status]
  );
  res.json(rows);
});

app.put("/admin/pending-requests/:id", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return res.status(401).json({ error: "unauthorized" });
  const { action, notes } = req.body || {};
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "invalid_action" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: cur } = await client.query("SELECT * FROM pending_verifications WHERE id=$1 FOR UPDATE", [req.params.id]);
    if (!cur.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "not_found" }); }
    const pending = cur[0];

    if (action === "approve") {
      if (pending.provided_membership_id) {
        const { rows: mem } = await client.query(
          "SELECT first_name, last_name FROM members WHERE membership_id=$1",
          [pending.provided_membership_id]
        );
        const fn = mem[0]?.first_name || null;
        const ln = mem[0]?.last_name || null;
        await client.query(
          `INSERT INTO users (external_id, first_name, last_name, membership_id)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (external_id) DO UPDATE SET
             membership_id=EXCLUDED.membership_id,
             first_name=COALESCE(EXCLUDED.first_name, users.first_name),
             last_name =COALESCE(EXCLUDED.last_name,  users.last_name),
             updated_at=now()`,
          [pending.external_id, fn, ln, pending.provided_membership_id]
        );
      } else {
        await client.query(
          `INSERT INTO users (external_id)
           VALUES ($1) ON CONFLICT (external_id) DO NOTHING`,
          [pending.external_id]
        );
      }

      await client.query(
        "UPDATE pending_verifications SET status='approved', notes=$2, updated_at=now() WHERE id=$1",
        [req.params.id, notes || null]
      );
    } else {
      await client.query(
        "UPDATE pending_verifications SET status='rejected', notes=$2, updated_at=now() WHERE id=$1",
        [req.params.id, notes || null]
      );
    }

    await client.query("COMMIT");
    res.json({ ok: true, external_id: pending.external_id });
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "update_failed" });
  } finally {
    client.release();
  }
});

app.put("/admin/users/link", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return res.status(401).json({ error: "unauthorized" });
  const { external_id, membership_id } = req.body || {};
  if (!external_id || !membership_id) return res.status(400).json({ error: "required" });
  const { rows: mem } = await pool.query("SELECT first_name, last_name FROM members WHERE membership_id=$1", [membership_id]);
  const fn = mem[0]?.first_name || null;
  const ln = mem[0]?.last_name || null;
  const { rows } = await pool.query(
    `INSERT INTO users (external_id, membership_id, first_name, last_name)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (external_id) DO UPDATE SET
       membership_id=EXCLUDED.membership_id,
       first_name=COALESCE(EXCLUDED.first_name, users.first_name),
       last_name =COALESCE(EXCLUDED.last_name, users.last_name),
       updated_at=now()
     RETURNING id, external_id, membership_id, first_name, last_name`,
    [String(external_id), String(membership_id), fn, ln]
  );
  res.json(rows[0]);
});

/* ---------------- RAFFLES ---------------- */
app.post("/raffle/enter", async (req, res) => {
  const { external_id, raffle_key } = req.body || {};
  const key = (raffle_key || "default_raffle").toString();
  if (!external_id) return res.status(400).json({ error: "external_id_required" });
  const { rows: r } = await pool.query("SELECT key FROM raffles WHERE key=$1 AND active=true", [key]);
  if (!r.length) return res.status(400).json({ error: "raffle_inactive" });
  try {
    await pool.query("INSERT INTO raffle_entries (raffle_key, external_id) VALUES ($1,$2)", [key, String(external_id)]);
    return res.json({ joined: true });
  } catch {
    return res.json({ joined: false, reason: "already" });
  }
});

app.get("/raffles/active", async (_req, res) => {
  const { rows } = await pool.query("SELECT key, title FROM raffles WHERE active=true ORDER BY created_at DESC");
  res.json(rows);
});

app.post("/admin/raffles", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return res.status(401).json({ error: "unauthorized" });
  const { key, title, active } = req.body || {};
  if (!key || !title) return res.status(400).json({ error: "required" });
  const { rows } = await pool.query(
    "INSERT INTO raffles (key, title, active) VALUES ($1,$2,COALESCE($3,true)) ON CONFLICT (key) DO NOTHING RETURNING key, title, active",
    [String(key), String(title), active ?? true]
  );
  if (!rows.length) return res.status(409).json({ error: "exists" });
  res.json(rows[0]);
});

app.put("/admin/raffles/:key", async (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) return res.status(401).json({ error: "unauthorized" });
  const { title, active } = req.body || {};
  const { rows } = await pool.query(
    "UPDATE raffles SET title=COALESCE($2,title), active=COALESCE($3,active) WHERE key=$1 RETURNING key, title, active",
    [req.params.key, title || null, typeof active === "boolean" ? active : null]
  );
  if (!rows.length) return res.status(404).json({ error: "not_found" });
  res.json(rows[0]);
});

/* ---------------- NOTIFICATION TEMPLATES (admin) ---------------- */
function auth(req, res) {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}

// Liste
app.get("/admin/notifications/templates", async (req, res) => {
  if (!auth(req, res)) return;
  const { rows } = await pool.query(
    "SELECT key, title, content, image_url, buttons, active, updated_at FROM notification_templates ORDER BY updated_at DESC"
  );
  res.json(rows);
});

// Tek kayıt
app.get("/admin/notifications/templates/:key", async (req, res) => {
  if (!auth(req, res)) return;
  const { rows } = await pool.query(
    "SELECT key, title, content, image_url, buttons, active, updated_at FROM notification_templates WHERE key=$1 LIMIT 1",
    [req.params.key]
  );
  if (!rows.length) return res.status(404).json({ error: "not_found" });
  res.json(rows[0]);
});

// Oluştur
app.post("/admin/notifications/templates", async (req, res) => {
  if (!auth(req, res)) return;
  const { key, title, content, image_url, buttons, active } = req.body || {};
  if (!key || !title || !content) return res.status(400).json({ error: "required" });
  const { rows } = await pool.query(
    `INSERT INTO notification_templates (key, title, content, image_url, buttons, active)
     VALUES ($1,$2,$3,$4,COALESCE($5,'[]'::jsonb),COALESCE($6,true))
     ON CONFLICT (key) DO NOTHING
     RETURNING key, title, content, image_url, buttons, active, updated_at`,
    [String(key), String(title), String(content), image_url || null, buttons || null, active ?? true]
  );
  if (!rows.length) return res.status(409).json({ error: "exists" });
  res.json(rows[0]);
});

// Güncelle
app.put("/admin/notifications/templates/:key", async (req, res) => {
  if (!auth(req, res)) return;
  const { title, content, image_url, buttons, active } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE notification_templates
     SET title=COALESCE($2,title),
         content=COALESCE($3,content),
         image_url=$4,
         buttons=COALESCE($5,buttons),
         active=COALESCE($6,active),
         updated_at=now()
     WHERE key=$1
     RETURNING key, title, content, image_url, buttons, active, updated_at`,
    [req.params.key, title || null, content || null, image_url || null, buttons || null, typeof active === "boolean" ? active : null]
  );
  if (!rows.length) return res.status(404).json({ error: "not_found" });
  res.json(rows[0]);
});

// Sil
app.delete("/admin/notifications/templates/:key", async (req, res) => {
  if (!auth(req, res)) return;
  const { rowCount } = await pool.query("DELETE FROM notification_templates WHERE key=$1", [req.params.key]);
  if (!rowCount) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(port, () => console.log(`API on :${port}`)))
  .catch((e) => { console.error("DB init error", e); process.exit(1); });
