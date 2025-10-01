import { Router } from "express";
import { pool } from "../db.js";

export function usersRouter() {
  const r = Router();

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
        name=COALESCE(EXCLUDED.name,users.name),
        first_name=COALESCE(EXCLUDED.first_name,users.first_name),
        last_name=COALESCE(EXCLUDED.last_name,users.last_name),
        membership_id=COALESCE(EXCLUDED.membership_id,users.membership_id),
        tg_first_name=COALESCE(EXCLUDED.tg_first_name,users.tg_first_name),
        tg_last_name=COALESCE(EXCLUDED.tg_last_name,users.tg_last_name),
        tg_username=COALESCE(EXCLUDED.tg_username,users.tg_username),
        submitted_username=COALESCE(EXCLUDED.submitted_username,users.submitted_username),
        updated_at=now()
      RETURNING id,external_id,name,first_name,last_name,membership_id,
                tg_first_name,tg_last_name,tg_username,submitted_username
    `;
    const { rows } = await pool.query(q, [
      external_id, name || null, first_name || null, last_name || null, membership_id || null,
      tg_first_name || null, tg_last_name || null, tg_username || null, submitted_username || null
    ]);
    res.json(rows[0]);
  });

  r.get("/", async (_req,res)=>{
    const q = `
      SELECT u.id,u.external_id,u.name,u.first_name,u.last_name,u.membership_id,
             u.tg_first_name,u.tg_last_name,u.tg_username,u.submitted_username,
             CASE
               WHEN u.membership_id IS NOT NULL THEN 'member'
               WHEN EXISTS (SELECT 1 FROM pending_verifications p WHERE p.external_id=u.external_id AND p.status='pending') THEN 'pending'
               ELSE 'guest'
             END AS status
      FROM users u ORDER BY u.id DESC LIMIT 1000
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  });

  r.get("/by-external/:external_id", async (req,res)=>{
    const { rows } = await pool.query(
      "SELECT id,external_id,first_name,last_name,membership_id FROM users WHERE external_id=$1 LIMIT 1",
      [req.params.external_id]
    );
    if (!rows.length) return res.status(404).json({ error:"not_found" });
    res.json(rows[0]);
  });

  r.get("/status/:external_id", async (req,res)=>{
    const ext = String(req.params.external_id);
    const ures = await pool.query(
      "SELECT id,external_id,first_name,last_name,membership_id FROM users WHERE external_id=$1 LIMIT 1",
      [ext]
    );
    const user = ures.rows[0] || null;
    const pres = await pool.query(
      "SELECT id,provided_membership_id,full_name,status,created_at FROM pending_verifications WHERE external_id=$1 AND status='pending' ORDER BY id DESC LIMIT 1",
      [ext]
    );
    const pending = pres.rows[0] || null;
    let stage = "guest";
    if (user?.membership_id) stage = "member";
    else if (pending) stage = "pending";
    res.json({ stage, user, pending });
  });

  return r;
}
