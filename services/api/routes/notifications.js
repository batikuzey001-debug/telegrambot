import { Router } from "express";
import { pool } from "../db.js";
import { buildFixedButtons } from "../utils/buttons.js";

const BOT_NOTIFY_URL = process.env.BOT_NOTIFY_URL || "";
const ADMIN_NOTIFY_SECRET = process.env.ADMIN_NOTIFY_SECRET || "";

/* html escape + kişiselleştirilmiş metin */
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function renderText(title, fullName, content) {
  const lines = [];
  if (title) lines.push(`<b>${escapeHtml(title)}</b>`);
  if (fullName) lines.push(`Sayın ${escapeHtml(fullName)},`, "");
  lines.push(escapeHtml(content || ""));
  return lines.join("\n");
}

/* tek kullanıcıya gönder */
async function sendToOne(external_id, tpl) {
  const { rows } = await pool.query(
    "SELECT first_name,last_name FROM users WHERE external_id=$1 LIMIT 1",
    [String(external_id)]
  );
  const fullName = [rows[0]?.first_name, rows[0]?.last_name].filter(Boolean).join(" ").trim();
  const text = renderText(tpl.title, fullName, tpl.content);
  const buttons = JSON.parse(buildFixedButtons()); // [{text,url}]
  const payload = { external_id: String(external_id), text, buttons, image_url: tpl.image_url || null };

  const r = await fetch(BOT_NOTIFY_URL, {
    method: "POST",
    headers: { "Content-Type":"application/json", "x-admin-secret": ADMIN_NOTIFY_SECRET },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`notify_failed:${r.status}`);
}

export function notificationsRouter(auth) {
  const r = Router();

  /* CRUD (mevcut) */
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
    const buttonsJson = buildFixedButtons();
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
    const buttonsJson = buildFixedButtons();
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

  /* === YENİ: SEND === */
  r.post("/send", auth, async (req,res)=>{
    if (!BOT_NOTIFY_URL || !ADMIN_NOTIFY_SECRET) {
      return res.status(500).json({ error:"misconfigured_bot_notify" });
    }
    const { key, external_ids, segment } = req.body || {};
    if (!key) return res.status(400).json({ error:"key_required" });

    const { rows: tplRows } = await pool.query(
      "SELECT key,title,content,image_url FROM notification_templates WHERE key=$1 AND active=true LIMIT 1",
      [String(key)]
    );
    if (!tplRows.length) return res.status(404).json({ error:"template_not_found" });
    const tpl = tplRows[0];

    let targets = [];
    if (Array.isArray(external_ids) && external_ids.length) {
      targets = external_ids.map(String);
    } else if (segment === "all_members") {
      const { rows } = await pool.query("SELECT external_id FROM users WHERE membership_id IS NOT NULL");
      targets = rows.map(r => String(r.external_id));
    } else if (segment === "all_users") {
      const { rows } = await pool.query("SELECT external_id FROM users");
      targets = rows.map(r => String(r.external_id));
    } else {
      return res.status(400).json({ error:"no_targets" });
    }
    targets = Array.from(new Set(targets));

    let ok = 0, fail = 0;
    for (const ext of targets) {
      try { await sendToOne(ext, tpl); ok++; } catch { fail++; }
    }
    return res.json({ ok, fail, total: targets.length });
  });

  return r;
}
