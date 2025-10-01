// services/api/routes/users.js
import { Router } from "express";
import { pool } from "../db.js";

export function usersRouter(auth) {
  const r = Router();

  // UPSERT (bot veya panel)
  r.post("/", async (req, res) => {
    const {
      external_id, name, first_name, last_name, membership_id,
      tg_first_name, tg_last_name, tg_username, submitted_username
    } = req.body || {};
    if (!external_id) return res.status(400).json({ error: "external_id required" });

    const q = `
      INSERT INTO users (
        external_id, name, first_name, last_name, membership_id,
        tg_first_name, tg_last_name, tg_username, submitted_username
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (external_id) DO UPDATE SET
        name                 = COALESCE(EXCLUDED.name, users.name),
        first_name           = COALESCE(EXCLUDED.first_name, users.first_name),
        last_name            = COALESCE(EXCLUDED.last_name, users.last_name),
        membership_id        = COALESCE(EXCLUDED.membership_id, users.membership_id),
        tg_first_name        = COALESCE(EXCLUDED.tg_first_name, users.tg_first_name),
        tg_last_name         = COALESCE(EXCLUDED.tg_last_name, users.tg_last_name),
        tg_username          = COALESCE(EXCLUDED.tg_username, users.tg_username),
        submitted_username   = COALESCE(EXCLUDED.submitted_username, users.submitted_username),
        updated_at           = now()
      RETURNING id, external_id, name, first_name, last_name, membership_id,
                tg_first_name, tg_last_name, tg_username, submitted_username
    `;
    const { rows } = await pool.query(q, [
      String(external_id),
      name || null, first_name || null, last_name || null, membership_id || null,
      tg_first_name || null, tg_last_name || null, tg_username || null, submitted_username || null
    ]);
    res.json(rows[0]);
  });

  // LIST + FİLTRE
  r.get("/", async (req, res) => {
    const qtxt = (req.query.q || "").toString().trim().toLowerCase();
    const mid = (req.query.membership_id || "").toString().trim();
    const tg = (req.query.tg_username || "").toString().trim().toLowerCase();

    const wh = [];
    const params = [];
    let i = 1;

    if (mid) { wh.push(`u.membership_id = $${i++}`); params.push(mid); }
    if (tg)  { wh.push(`LOWER(u.tg_username) = $${i++}`); params.push(tg); }
    if (qtxt) {
      wh.push(`(
        LOWER(u.first_name) LIKE $${i}
        OR LOWER(u.last_name) LIKE $${i}
        OR LOWER(u.submitted_username) LIKE $${i}
        OR LOWER(u.tg_username) LIKE $${i}
        OR u.external_id = $${i + 1}
        OR u.membership_id = $${i + 2}
      )`);
      params.push(`%${qtxt}%`, qtxt, qtxt);
      i += 3;
    }

    const where = wh.length ? `WHERE ${wh.join(" AND ")}` : "";
    const sql = `
      SELECT
        u.id, u.external_id, u.name, u.first_name, u.last_name, u.membership_id,
        u.tg_first_name, u.tg_last_name, u.tg_username, u.submitted_username,
        CASE
          WHEN u.membership_id IS NOT NULL THEN 'member'
          WHEN EXISTS (SELECT 1 FROM pending_verifications p WHERE p.external_id = u.external_id AND p.status = 'pending') THEN 'pending'
          ELSE 'guest'
        END AS status
      FROM users u
      ${where}
      ORDER BY u.id DESC
      LIMIT 1000
    `;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  });

  // BY EXTERNAL
  r.get("/by-external/:external_id", async (req, res) => {
    const { rows } = await pool.query(
      "SELECT id, external_id, first_name, last_name, membership_id FROM users WHERE external_id=$1 LIMIT 1",
      [req.params.external_id]
    );
    if (!rows.length) return res.status(404).json({ error: "not_found" });
    res.json(rows[0]);
  });

  // STATUS
  r.get("/status/:external_id", async (req, res) => {
    const ext = String(req.params.external_id);
    const ures = await pool.query(
      "SELECT id, external_id, first_name, last_name, membership_id FROM users WHERE external_id=$1 LIMIT 1",
      [ext]
    );
    const user = ures.rows[0] || null;
    const pres = await pool.query(
      "SELECT id, provided_membership_id, full_name, status, created_at FROM pending_verifications WHERE external_id=$1 AND status='pending' ORDER BY id DESC LIMIT 1",
      [ext]
    );
    const pending = pres.rows[0] || null;
    const stage = user?.membership_id ? "member" : (pending ? "pending" : "guest");
    res.json({ stage, user, pending });
  });

  // ADMIN: KISMİ GÜNCELLE
  r.patch("/admin/:external_id", auth, async (req, res) => {
    const { membership_id, first_name, last_name, tg_username, submitted_username, name } = req.body || {};
    try {
      const { rows } = await pool.query(
        `UPDATE users
         SET membership_id       = COALESCE($2, membership_id),
             first_name          = COALESCE($3, first_name),
             last_name           = COALESCE($4, last_name),
             tg_username         = COALESCE($5, tg_username),
             submitted_username  = COALESCE($6, submitted_username),
             name                = COALESCE($7, name),
             updated_at          = now()
         WHERE external_id = $1
         RETURNING id, external_id, membership_id, first_name, last_name, tg_username, submitted_username, name`,
        [
          String(req.params.external_id),
          membership_id ?? null, first_name ?? null, last_name ?? null,
          tg_username ?? null, submitted_username ?? null, name ?? null
        ]
      );
      if (!rows.length) return res.status(404).json({ error: "not_found" });
      res.json(rows[0]);
    } catch (e) {
      console.error("[USR PATCH ERR]", e);
      res.status(500).json({ error: "update_failed" });
    }
  });

  // ADMIN: SİL (ilişkili kayıtlarla) + LOG
  r.delete("/admin/:external_id", auth, async (req, res) => {
    const ext = String(req.params.external_id);
    const client = await pool.connect();
    try {
      console.log(`[USR DEL] ext=${ext}`);
      await client.query("BEGIN");
      await client.query("DELETE FROM raffle_entries WHERE external_id=$1", [ext]);
      await client.query("DELETE FROM pending_verifications WHERE external_id=$1", [ext]);
      const del = await client.query("DELETE FROM users WHERE external_id=$1 RETURNING id", [ext]);
      await client.query("COMMIT");
      if (!del.rowCount) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("[USR DEL ERR]", e?.message || e, e?.code ? { code: e.code, detail: e.detail, where: e.where } : "");
      res.status(500).json({ error: "delete_failed" });
    } finally {
      client.release();
    }
  });

  return r;
}
