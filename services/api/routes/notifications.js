import { Router } from "express";
import { pool } from "../db.js";
import { buildFixedButtons } from "../utils/buttons.js";

export function notificationsRouter(auth) {
  const r = Router();

  r.get("/templates", auth, async (_req,res)=>{
    const { rows } = await pool.query(
      "SELECT key,title,content,image_url,buttons,active,updated_at FROM notification_templates ORDER BY updated_at DESC"
    );
    res.json(rows);
  });

  r.get("/templates/:key", auth, async (req,res)=>{
    const { rows } = await pool.query(
      "SELECT key,title,content,image_url,buttons,active,updated_at FROM notification_templates WHERE key=$1 LIMIT 1",
      [req.params.key]
    );
    if (!rows.length) return res.status(404).json({ error:"not_found" });
    res.json(rows[0]);
  });

  r.post("/templates", auth, async (req,res)=>{
    const { key,title,content,image_url,active } = req.body || {};
    if (!key || !title || !content) return res.status(400).json({ error:"required" });

    const buttonsJson = buildFixedButtons(); // istemci buttons yok sayılır
    const { rows } = await pool.query(
      `INSERT INTO notification_templates (key,title,content,image_url,buttons,active)
       VALUES ($1,$2,$3,$4,$5::jsonb,COALESCE($6,true))
       ON CONFLICT (key) DO NOTHING
       RETURNING key,title,content,image_url,buttons,active,updated_at`,
      [String(key), String(title), String(content), image_url || null, buttonsJson, active ?? true]
    );
    if (!rows.length) return res.status(409).json({ error:"exists" });
    res.json(rows[0]);
  });

  r.put("/templates/:key", auth, async (req,res)=>{
    const { title,content,image_url,active } = req.body || {};
    const buttonsJson = buildFixedButtons(); // her güncellemede sabit set

    const { rows } = await pool.query(
      `UPDATE notification_templates
       SET title=COALESCE($2,title),
           content=COALESCE($3,content),
           image_url=$4,
           buttons=$5::jsonb,
           active=COALESCE($6,active),
           updated_at=now()
       WHERE key=$1
       RETURNING key,title,content,image_url,buttons,active,updated_at`,
      [req.params.key, title||null, content||null, typeof image_url==="undefined"?null:(image_url||null), buttonsJson, typeof active==="boolean"?active:null]
    );
    if (!rows.length) return res.status(404).json({ error:"not_found" });
    res.json(rows[0]);
  });

  r.delete("/templates/:key", auth, async (req,res)=>{
    const { rowCount } = await pool.query("DELETE FROM notification_templates WHERE key=$1",[req.params.key]);
    if (!rowCount) return res.status(404).json({ error:"not_found" });
    res.json({ ok:true });
  });

  return r;
}
