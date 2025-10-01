import { Router } from "express";
import { pool } from "../db.js";
import fetch from "node-fetch";

const BOT_INVALIDATE_URL = process.env.BOT_INVALIDATE_URL || "";
const CACHE_SECRET = process.env.CACHE_SECRET || "";
const BOT_WRITE_SECRET = process.env.BOT_WRITE_SECRET || "";

export function messagesRouter(auth) {
  const r = Router();

  r.get("/:key", async (req, res) => {
    const { rows } = await pool.query(
      "SELECT content,image_url,file_id FROM messages WHERE key=$1 AND active=true LIMIT 1",
      [req.params.key]
    );
    if (!rows.length) return res.status(404).json({ error: "not_found" });
    res.json(rows[0]);
  });

  r.get("/", async (_req, res) => {
    const { rows } = await pool.query(
      "SELECT key,content,image_url,file_id,updated_at FROM messages WHERE active=true ORDER BY key ASC"
    );
    res.json(rows);
  });

  r.put("/admin/:key", auth, async (req, res) => {
    const { content, image_url } = req.body || {};
    if (!content && !image_url) return res.status(400).json({ error: "no_changes" });

    const q = `
      INSERT INTO messages (key,content,image_url,active)
      VALUES ($1,COALESCE($2,''),$3,true)
      ON CONFLICT (key) DO UPDATE SET
        content = COALESCE($2,messages.content),
        image_url = COALESCE($3,messages.image_url),
        file_id = CASE WHEN $3 IS NOT NULL AND $3 <> messages.image_url THEN NULL ELSE messages.file_id END,
        updated_at=now()
      RETURNING key,content,image_url,file_id,updated_at
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

  r.put("/bot/:key/file-id", async (req, res) => {
    if ((req.headers["x-bot-secret"] || "") !== BOT_WRITE_SECRET) return res.status(401).json({ error: "unauthorized" });
    const { file_id } = req.body || {};
    if (!file_id) return res.status(400).json({ error: "file_id_required" });
    const { rows } = await pool.query(
      "UPDATE messages SET file_id=$1, updated_at=now() WHERE key=$2 RETURNING key,file_id",
      [file_id, req.params.key]
    );
    if (!rows.length) return res.status(404).json({ error: "not_found" });
    res.json(rows[0]);
  });

  return r;
}
