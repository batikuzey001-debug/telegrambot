import { Router } from "express";

const BOT_DM_URL = process.env.BOT_DM_URL || process.env.BOT_NOTIFY_URL || "";
const ADMIN_NOTIFY_SECRET = process.env.ADMIN_NOTIFY_SECRET || "";

export function dmRouter(auth){
  const r = Router();

  // Tek kişiye DM: { external_id, text, image_url?, buttons? }
  r.post("/admin/dm", auth, async (req,res)=>{
    if (!BOT_DM_URL || !ADMIN_NOTIFY_SECRET) return res.status(500).json({ error:"misconfigured_bot_dm" });
    const { external_id, text, image_url, buttons } = req.body || {};
    if (!external_id || !text) return res.status(400).json({ error:"required" });

    try{
      const r2 = await fetch(BOT_DM_URL, {
        method:"POST",
        headers:{ "Content-Type":"application/json", "x-admin-secret": ADMIN_NOTIFY_SECRET },
        body: JSON.stringify({
          external_id: String(external_id),
          text: String(text),
          image_url: image_url || null,
          buttons: Array.isArray(buttons) ? buttons : []
        })
      });
      const out = await r2.text();
      return res.status(r2.status).type("application/json").send(out);
    }catch(e){
      console.error("[API DM ERR]", e?.message || e);
      return res.status(502).json({ error:"bot_unreachable" });
    }
  });

  return r;
}
