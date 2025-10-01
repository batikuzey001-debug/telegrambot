import express from "express";
import fetch from "node-fetch";
import { pool, initDb } from "./db.js";
import { makeAuth } from "./middleware/auth.js";
import { notificationsRouter } from "./routes/notifications.js";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const BOT_INVALIDATE_URL = process.env.BOT_INVALIDATE_URL || "";
const CACHE_SECRET = process.env.CACHE_SECRET || "";
const BOT_WRITE_SECRET = process.env.BOT_WRITE_SECRET || "";

const app = express();
app.use(express.json());
const auth = makeAuth(ADMIN_TOKEN);

/* health */
app.get("/", (_req,res)=>res.json({ ok:true }));

/* messages (kalan uçlarınızla aynı) */
app.get("/messages/:key", async (req,res)=>{
  const { rows } = await pool.query(
    "SELECT content,image_url,file_id FROM messages WHERE key=$1 AND active=true LIMIT 1",
    [req.params.key]
  );
  if (!rows.length) return res.status(404).json({ error:"not_found" });
  res.json(rows[0]);
});

app.put("/admin/messages/:key", auth, async (req,res)=>{
  const { content,image_url } = req.body || {};
  if (!content && !image_url) return res.status(400).json({ error:"no_changes" });
  const q = `
    INSERT INTO messages (key,content,image_url,active)
    VALUES ($1,COALESCE($2,''),$3,true)
    ON CONFLICT (key) DO UPDATE SET
      content=COALESCE($2,messages.content),
      image_url=COALESCE($3,messages.image_url),
      file_id=CASE WHEN $3 IS NOT NULL AND $3 <> messages.image_url THEN NULL ELSE messages.file_id END,
      updated_at=now()
    RETURNING key,content,image_url,file_id,updated_at
  `;
  const { rows } = await pool.query(q,[req.params.key, content||null, image_url||null]);

  if (BOT_INVALIDATE_URL && CACHE_SECRET) {
    try {
      await fetch(BOT_INVALIDATE_URL, {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-cache-secret":CACHE_SECRET },
        body: JSON.stringify({ key:req.params.key })
      });
    } catch(e){ console.warn("invalidate failed:", e?.message || e); }
  }
  res.json(rows[0]);
});

/* bot file_id */
app.put("/bot/messages/:key/file-id", async (req,res)=>{
  if ((req.headers["x-bot-secret"]||"") !== BOT_WRITE_SECRET) return res.status(401).json({ error:"unauthorized" });
  const { file_id } = req.body||{};
  if (!file_id) return res.status(400).json({ error:"file_id_required" });
  const { rows } = await pool.query(
    "UPDATE messages SET file_id=$1, updated_at=now() WHERE key=$2 RETURNING key,file_id",
    [file_id, req.params.key]
  );
  if (!rows.length) return res.status(404).json({ error:"not_found" });
  res.json(rows[0]);
});

/* TODO: users, members, raffles, pending uçlarınızı burada mevcut dosyadan birebir taşıyın. */

/* notifications module */
app.use("/admin/notifications", notificationsRouter(auth));

const port = process.env.PORT || 3000;
initDb()
  .then(()=> app.listen(port, ()=>console.log(`API on :${port}`)))
  .catch((e)=>{ console.error("DB init error", e); process.exit(1); });
