import { Router } from "express";
import { pool } from "../db.js";

export function membersRouter(auth) {
  const r = Router();

  r.get("/:membership_id", async (req,res)=>{
    const { rows } = await pool.query(
      "SELECT membership_id,first_name,last_name FROM members WHERE membership_id=$1 LIMIT 1",
      [req.params.membership_id]
    );
    if (!rows.length) return res.json({ found:false });
    const m = rows[0];
    res.json({ found:true, membership_id:m.membership_id, first_name:m.first_name, last_name:m.last_name });
  });

  r.post("/admin/import", auth, async (req,res)=>{
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error:"empty" });
    const client = await pool.connect();
    try{
      await client.query("BEGIN");
      for (const r0 of rows) {
        if (!r0.membership_id || !r0.first_name || !r0.last_name) continue;
        await client.query(
          `INSERT INTO members (membership_id,first_name,last_name)
           VALUES ($1,$2,$3)
           ON CONFLICT (membership_id) DO UPDATE SET
             first_name=EXCLUDED.first_name,
             last_name=EXCLUDED.last_name,
             updated_at=now()`,
          [String(r0.membership_id), String(r0.first_name), String(r0.last_name)]
        );
      }
      await client.query("COMMIT");
      res.json({ ok:true, count: rows.length });
    }catch{
      await client.query("ROLLBACK");
      res.status(500).json({ error:"import_failed" });
    }finally{ client.release(); }
  });

  r.post("/pending-requests", async (req,res)=>{
    const { external_id, provided_membership_id, full_name, notes } = req.body || {};
    if (!external_id || !full_name) return res.status(400).json({ error:"external_id_and_full_name_required" });
    const { rows } = await pool.query(
      `INSERT INTO pending_verifications (external_id,provided_membership_id,full_name,notes)
       VALUES ($1,$2,$3,$4) RETURNING id,status`,
      [String(external_id), provided_membership_id || null, String(full_name), notes || null]
    );
    res.json(rows[0]);
  });

  r.get("/admin/pending-requests", auth, async (req,res)=>{
    const status = (req.query.status || "pending").toString();
    const { rows } = await pool.query(
      "SELECT id,external_id,provided_membership_id,full_name,status,notes,created_at FROM pending_verifications WHERE status=$1 ORDER BY id DESC",
      [status]
    );
    res.json(rows);
  });

  r.put("/admin/pending-requests/:id", auth, async (req,res)=>{
    const { action, notes } = req.body || {};
    if (!["approve","reject"].includes(action)) return res.status(400).json({ error:"invalid_action" });

    const client = await pool.connect();
    try{
      await client.query("BEGIN");
      const { rows:cur } = await client.query("SELECT * FROM pending_verifications WHERE id=$1 FOR UPDATE",[req.params.id]);
      if (!cur.length) { await client.query("ROLLBACK"); return res.status(404).json({ error:"not_found" }); }
      const p = cur[0];

      if (action === "approve") {
        let fn=null, ln=null;
        if (p.full_name) {
          const parts = String(p.full_name).trim().split(/\s+/);
          fn = parts.shift() || null;
          ln = parts.length ? parts.join(" ") : null;
        }
        if (p.provided_membership_id) {
          const { rows:mem } = await client.query(
            "SELECT first_name,last_name FROM members WHERE membership_id=$1",
            [p.provided_membership_id]
          );
          const mfn = mem[0]?.first_name || fn;
          const mln = mem[0]?.last_name  || ln;
          await client.query(
            `INSERT INTO users (external_id,first_name,last_name,membership_id)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (external_id) DO UPDATE SET
               membership_id=EXCLUDED.membership_id,
               first_name=COALESCE(EXCLUDED.first_name,users.first_name),
               last_name =COALESCE(EXCLUDED.last_name, users.last_name),
               updated_at=now()`,
            [p.external_id, mfn, mln, p.provided_membership_id]
          );
        } else {
          await client.query(
            `INSERT INTO users (external_id,first_name,last_name)
             VALUES ($1,$2,$3)
             ON CONFLICT (external_id) DO UPDATE SET
               first_name=COALESCE(EXCLUDED.first_name,users.first_name),
               last_name =COALESCE(EXCLUDED.last_name, users.last_name),
               updated_at=now()`,
            [p.external_id, fn, ln]
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
      res.json({ ok:true, external_id:p.external_id });
    }catch{
      await client.query("ROLLBACK");
      res.status(500).json({ error:"update_failed" });
    }finally{ client.release(); }
  });

  r.put("/admin/users/link", auth, async (req,res)=>{
    const { external_id, membership_id } = req.body || {};
    if (!external_id || !membership_id) return res.status(400).json({ error:"required" });
    const { rows:mem } = await pool.query(
      "SELECT first_name,last_name FROM members WHERE membership_id=$1",
      [membership_id]
    );
    const fn = mem[0]?.first_name || null;
    const ln = mem[0]?.last_name || null;
    const { rows } = await pool.query(
      `INSERT INTO users (external_id,membership_id,first_name,last_name)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (external_id) DO UPDATE SET
         membership_id=EXCLUDED.membership_id,
         first_name=COALESCE(EXCLUDED.first_name,users.first_name),
         last_name =COALESCE(EXCLUDED.last_name, users.last_name),
         updated_at=now()
       RETURNING id,external_id,membership_id,first_name,last_name`,
      [String(external_id), String(membership_id), fn, ln]
    );
    res.json(rows[0]);
  });

  return r;
}
