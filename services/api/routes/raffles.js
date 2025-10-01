import { Router } from "express";
import { pool } from "../db.js";

export function rafflesRouter(auth) {
  const r = Router();

  r.post("/enter", async (req,res)=>{
    const { external_id, raffle_key } = req.body || {};
    const key = (raffle_key || "default_raffle").toString();
    if (!external_id) return res.status(400).json({ error:"external_id_required" });
    const { rows: rr } = await pool.query("SELECT key FROM raffles WHERE key=$1 AND active=true",[key]);
    if (!rr.length) return res.status(400).json({ error:"raffle_inactive" });
    try {
      await pool.query("INSERT INTO raffle_entries (raffle_key,external_id) VALUES ($1,$2)",[key, String(external_id)]);
      return res.json({ joined:true });
    } catch {
      return res.json({ joined:false, reason:"already" });
    }
  });

  r.get("/active", async (_req,res)=>{
    const { rows } = await pool.query("SELECT key,title FROM raffles WHERE active=true ORDER BY created_at DESC");
    res.json(rows);
  });

  r.get("/admin/entries", auth, async (req,res)=>{
    const key = (req.query.key || "default_raffle").toString();
    const { rows } = await pool.query(
      `SELECT re.id,re.external_id,re.created_at,
              u.membership_id,u.first_name,u.last_name,u.tg_username,u.submitted_username
       FROM raffle_entries re
       LEFT JOIN users u ON u.external_id = re.external_id
       WHERE re.raffle_key=$1
       ORDER BY re.id DESC`,
      [key]
    );
    res.json(rows);
  });

  r.post("/admin", auth, async (req,res)=>{
    const { key,title,active } = req.body || {};
    if (!key || !title) return res.status(400).json({ error:"required" });
    const { rows } = await pool.query(
      "INSERT INTO raffles (key,title,active) VALUES ($1,$2,COALESCE($3,true)) ON CONFLICT (key) DO NOTHING RETURNING key,title,active",
      [String(key), String(title), active ?? true]
    );
    if (!rows.length) return res.status(409).json({ error:"exists" });
    res.json(rows[0]);
  });

  r.put("/admin/:key", auth, async (req,res)=>{
    const { title,active } = req.body || {};
    const { rows } = await pool.query(
      "UPDATE raffles SET title=COALESCE($2,title), active=COALESCE($3,active) WHERE key=$1 RETURNING key,title,active",
      [req.params.key, title || null, typeof active === "boolean" ? active : null]
    );
    if (!rows.length) return res.status(404).json({ error:"not_found" });
    res.json(rows[0]);
  });

  return r;
}
