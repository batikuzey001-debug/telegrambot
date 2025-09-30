import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import http from "http";
import https from "https";
import express from "express";

const {
  BOT_TOKEN, CHANNEL_USERNAME, APP_URL,
  CACHE_TTL_MS, BOT_WRITE_SECRET,
  SOCIAL_URL, SIGNUP_URL, ADMIN_NOTIFY_SECRET
} = process.env;

if (!BOT_TOKEN || !CHANNEL_USERNAME || !APP_URL) throw new Error("missing env");

const TTL = Number(CACHE_TTL_MS || 60000);

// API
const api = axios.create({
  baseURL: APP_URL, timeout: 3000,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

// Bot
const bot = new Telegraf(BOT_TOKEN);

// Admin notify HTTP
const app = express();
app.use(express.json());
app.post("/admin/notify", async (req, res) => {
  if ((req.headers["x-admin-secret"] || "") !== (ADMIN_NOTIFY_SECRET || ""))
    return res.status(401).json({ error: "unauthorized" });
  const { external_id, text } = req.body || {};
  if (!external_id || !text) return res.status(400).json({ error: "required" });
  try { await bot.telegram.sendMessage(String(external_id), text, { parse_mode: "HTML" }); res.json({ ok: true }); }
  catch { res.status(500).json({ error: "send_failed" }); }
});
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`bot http on :${port}`));

// Cache + helpers
const cache = new Map();
const getCached = k => { const it = cache.get(k); return it && it.exp > Date.now() ? it.value : null; };
const setCached = (k,v,ttl=TTL) => cache.set(k,{ value:v, exp:Date.now()+ttl });

async function fetchMessage(key){ const { data } = await api.get(`/messages/${key}`); setCached(key,data); return data; }
async function getMessage(key){ const c=getCached(key); if(c){ fetchMessage(key).catch(()=>{}); return c; } try{ return await fetchMessage(key); }catch{ return { content:"İçerik bulunamadı." }; } }
async function sendMessageByKey(ctx,key,extra){
  const msg = await getMessage(key);
  const p = ctx.reply(msg.content, extra).catch(()=>{});
  if(msg.file_id) setImmediate(async()=>{ try{ await ctx.replyWithPhoto(msg.file_id,{caption:msg.content}); }catch{} });
  else if(msg.image_url) setImmediate(async()=>{ try{
    const r=await axios.get(msg.image_url,{responseType:"arraybuffer",timeout:4000,maxRedirects:4});
    const sent=await ctx.replyWithPhoto({source:Buffer.from(r.data),filename:"image"},{caption:msg.content});
    if(sent?.photo?.length && BOT_WRITE_SECRET){
      const fid=sent.photo[sent.photo.length-1].file_id;
      await api.put(`/bot/messages/${key}/file-id`,{file_id:fid},{headers:{"x-bot-secret":BOT_WRITE_SECRET}});
      setCached(key,{...msg,file_id:fid});
    }
  }catch{} });
  return p;
}

async function isChannelMember(ctx){ try{ const m=await ctx.telegram.getChatMember(CHANNEL_USERNAME,ctx.from.id); return ["creator","administrator","member"].includes(m.status); }catch{ return false; } }
async function getStatus(externalId){ try{ const {data}=await api.get(`/users/status/${externalId}`); return data; }catch{ return { stage:"guest" }; } }

// Inline menüler
const KB = {
  ROOT: Markup.inlineKeyboard([
    [Markup.button.callback("👤 RadissonBet Üyesiyim", "role_member")],
    [Markup.button.callback("🙋‍♂️ Misafirim", "role_guest")]
  ]),
  MEMBER_HOME: Markup.inlineKeyboard([
    [Markup.button.callback("🧾 Hesap Bilgilerim", "m_account")],
    [Markup.button.callback("🎁 Ücretsiz Etkinlikler", "m_free")],
    [Markup.button.callback("⭐ Bana Özel Fırsatlar", "m_offers")],
    [Markup.button.callback("📢 Özel Kampanyalar", "m_campaigns")],
    [Markup.button.callback("🎟️ Çekilişe Katıl", "m_raffle")],
    [Markup.button.callback("🏠 Ana Menü", "go_root")]
  ]),
  GUEST_HOME: Markup.inlineKeyboard([
    [Markup.button.callback("📝 Üye Ol", "g_signup")],
    [Markup.button.callback("🏅 Radisson Ayrıcalıkları", "g_benefits")],
    [Markup.button.callback("📅 Etkinlikler ve Fırsatlar", "g_events")],
    [Markup.button.callback("📢 Özel Kampanyalar", "g_campaigns")],
    [Markup.button.callback("🏠 Ana Menü", "go_root")]
  ]),
  PENDING_HOME: Markup.inlineKeyboard([
    [Markup.button.callback("📄 Başvuru Durumunu Yenile", "p_refresh")],
    [Markup.button.callback("🏠 Ana Menü", "go_root")]
  ]),
  JOIN: Markup.inlineKeyboard([
    Markup.button.url("🔗 Kanala Katıl", `https://t.me/${CHANNEL_USERNAME.replace("@","")}`),
    Markup.button.callback("✅ Kontrol Et", "verify_join")
  ])
};

// State
const state = new Map(); // uid -> { stage:'ROOT'|'MEMBER'|'GUEST'|'PENDING', awaiting?, tmpMembership? }
const S = uid => { if(!state.has(uid)) state.set(uid,{ stage:"ROOT" }); return state.get(uid); };

// Render helpers
const showRoot    = (ctx)=> ctx.reply("👇 Lütfen bir seçenek seçin:", KB.ROOT);
const showMember  = (ctx,name)=> ctx.reply(name?`👋 Merhaba ${name}\n🧭 Üyelik menüsü:`:"🧭 Üyelik menüsü:", KB.MEMBER_HOME);
const showGuest   = (ctx)=> ctx.reply("🧭 Misafir menüsü:", KB.GUEST_HOME);
const showPending = (ctx)=> ctx.reply("⏳ Başvurunuz inceleniyor. Onaylandığında üyelik ana sayfanız açılacak.", KB.PENDING_HOME);

// Start
bot.start(async (ctx)=>{
  await sendMessageByKey(ctx,"welcome");
  const ok = await isChannelMember(ctx);
  if(!ok) return sendMessageByKey(ctx,"not_member",KB.JOIN);

  const st = await getStatus(String(ctx.from.id));
  if (st.stage === "member") {
    const name = [st.user?.first_name, st.user?.last_name].filter(Boolean).join(" ");
    S(ctx.from.id).stage = "MEMBER";
    return showMember(ctx, name);
  }
  if (st.stage === "pending") {
    S(ctx.from.id).stage = "PENDING";
    return showPending(ctx);
  }
  S(ctx.from.id).stage = "ROOT";
  return showRoot(ctx);
});

// Kanal kontrol
bot.action("verify_join", async (ctx)=>{
  const ok = await isChannelMember(ctx);
  await ctx.answerCbQuery(ok?"✅ Doğrulandı":"⛔ Üye görünmüyor");
  if(!ok) return;
  try{ await ctx.editMessageText("✅ Teşekkürler. Devam edebilirsiniz."); }catch{}
  return showRoot(ctx);
});

// ROOT → Üyelik akışı
bot.action("role_member", async (ctx)=>{
  S(ctx.from.id).awaiting = "membership";
  await ctx.reply("🔢 Üyelik ID’nizi girin (sadece rakam):");
});
bot.on("text", async (ctx)=>{
  const s = S(ctx.from.id);
  const text = (ctx.message.text || "").trim();

  if (s.awaiting === "membership") {
    if (!/^[0-9]+$/.test(text)) return ctx.reply("⚠️ Geçersiz ID. Sadece rakam girin.");
    try{
      const { data } = await api.get(`/members/${text}`);
      if (data.found) {
        await api.post(`/users`, {
          external_id:String(ctx.from.id),
          name: ctx.from.username || ctx.from.first_name || null,
          first_name: data.first_name,
          last_name: data.last_name,
          membership_id: text
        });
        s.awaiting = undefined; s.stage="MEMBER";
        return showMember(ctx, `${data.first_name} ${data.last_name}`);
      }
      s.awaiting = "fullname"; s.tmpMembership=text;
      return ctx.reply("📝 ID bulunamadı. Lütfen `Ad Soyad` yazın:");
    }catch{
      return ctx.reply("⚠️ Şu an doğrulama yapılamıyor. Tekrar deneyin.");
    }
  }

  if (s.awaiting === "fullname") {
    const full = text.replace(/\s+/g," ").trim();
    if (!full.includes(" ")) return ctx.reply("⚠️ Lütfen ad ve soyadı birlikte yazın.");
    try{
      await api.post(`/pending-requests`, {
        external_id:String(ctx.from.id),
        provided_membership_id:s.tmpMembership || null,
        full_name: full
      });
    }catch{}
    s.awaiting = undefined; s.tmpMembership=undefined; s.stage="PENDING";
    return showPending(ctx);
  }
});

// ROOT → Misafir
bot.action("role_guest", async (ctx)=>{ S(ctx.from.id).stage="GUEST"; return showGuest(ctx); });

// Pending yenile
bot.action("p_refresh", async (ctx)=>{
  const st = await getStatus(String(ctx.from.id));
  if (st.stage === "member") {
    const name = [st.user?.first_name, st.user?.last_name].filter(Boolean).join(" ");
    S(ctx.from.id).stage = "MEMBER";
    return showMember(ctx, name);
  }
  return ctx.answerCbQuery("⏳ Hâlâ beklemede").catch(()=>{});
});

// Member panelleri (yalnız üye)
async function requireMember(ctx){
  const st = await getStatus(String(ctx.from.id));
  if (st.stage !== "member") {
    await ctx.answerCbQuery("⛔ Üyelik gerekli", { show_alert: true }).catch(()=>{});
    return false;
  }
  return true;
}
bot.action("m_account", async (ctx)=>{ if(!(await requireMember(ctx))) return; await ctx.reply("🧾 Hesap bilgileri yakında düzenlenebilir.", KB.MEMBER_HOME); });
bot.action("m_free",    async (ctx)=>{ if(!(await requireMember(ctx))) return; return sendMessageByKey(ctx,"member_free_events",KB.MEMBER_HOME); });
bot.action("m_offers",  async (ctx)=>{ if(!(await requireMember(ctx))) return; return sendMessageByKey(ctx,"member_personal_offers",KB.MEMBER_HOME); });
bot.action("m_campaigns", async (ctx)=>{
  if(!(await requireMember(ctx))) return;
  try{
    const { data } = await api.get("/raffles/active");
    if(!Array.isArray(data)||!data.length) return ctx.reply("ℹ️ Aktif kampanya yok.", KB.MEMBER_HOME);
    const rows = data.map(r=>[Markup.button.callback(`📣 ${r.title}`, `raffle_join:${r.key}`)]);
    return ctx.reply("📢 Aktif kampanyalar:", Markup.inlineKeyboard([...rows,[Markup.button.callback("↩️ Geri","go_member")]]));
  }catch{ return ctx.reply("⚠️ Kampanyalar alınamadı.", KB.MEMBER_HOME); }
});
bot.action("go_member", (ctx)=> ctx.reply("🧭 Üyelik menüsü:", KB.MEMBER_HOME));
bot.action("m_raffle", async (ctx)=>{
  if(!(await requireMember(ctx))) return;
  try{
    const { data } = await api.post("/raffle/enter",{ external_id:String(ctx.from.id), raffle_key:"default_raffle" });
    if (data.joined) return sendMessageByKey(ctx,"raffle_joined",KB.MEMBER_HOME);
    if (data.reason==="already") return sendMessageByKey(ctx,"raffle_already",KB.MEMBER_HOME);
    return ctx.reply("⚠️ Çekiliş aktif değil.", KB.MEMBER_HOME);
  }catch{ return ctx.reply("⚠️ Çekiliş kaydı yapılamadı.", KB.MEMBER_HOME); }
});

// Guest panelleri (çekiliş yok)
bot.action("g_signup", async (ctx)=>{
  const kb = SIGNUP_URL
    ? Markup.inlineKeyboard([[Markup.button.url("📝 Kayıt Ol", SIGNUP_URL)],[Markup.button.callback("↩️ Geri","go_guest")]])
    : KB.GUEST_HOME;
  return ctx.reply("📝 Üye Ol açıklaması:", kb);
});
bot.action("g_benefits", async (ctx)=>{
  const kb = SOCIAL_URL
    ? Markup.inlineKeyboard([[Markup.button.url("🏅 Radisson Sosyal", SOCIAL_URL)],[Markup.button.callback("↩️ Geri","go_guest")]])
    : KB.GUEST_HOME;
  return ctx.reply("🏅 Ayrıcalıklar:", kb);
});
bot.action("g_events",   (ctx)=> sendMessageByKey(ctx,"events",KB.GUEST_HOME));
bot.action("g_campaigns",(ctx)=> ctx.reply("📢 Kampanyalar (katılmak için üye olmanız gerekir).", KB.GUEST_HOME));
bot.action("go_guest",   (ctx)=> ctx.reply("🧭 Misafir menüsü:", KB.GUEST_HOME));

// Ana menü
bot.action("go_root", (ctx)=> showRoot(ctx));

// Dinamik çekiliş join (yalnız üye)
bot.action(/raffle_join:.+/, async (ctx)=>{
  if(!(await requireMember(ctx))) return;
  const key = ctx.callbackQuery.data.split(":")[1];
  try{
    const { data } = await api.post("/raffle/enter",{ external_id:String(ctx.from.id), raffle_key:key });
    await ctx.answerCbQuery(data.joined?"🎟️ Katılım alındı":(data.reason==="already"?"🔁 Zaten katıldınız":"⛔ Pasif kampanya")).catch(()=>{});
    if (data.joined) await sendMessageByKey(ctx,"raffle_joined",KB.MEMBER_HOME);
    else if (data.reason==="already") await sendMessageByKey(ctx,"raffle_already",KB.MEMBER_HOME);
  }catch{ await ctx.answerCbQuery("⚠️ Hata").catch(()=>{}); }
});

// Bilinmeyen callback → köke dön
bot.on("callback_query", async (ctx, next)=>{
  const d = ctx.callbackQuery?.data || "";
  const known = /^(role_|g_|m_|go_|p_refresh|raffle_join:)/.test(d);
  if (!known) {
    console.warn("unknown cb:", d);
    await ctx.answerCbQuery("⚠️ Geçersiz seçim").catch(()=>{});
    return showRoot(ctx);
  }
  return next();
});

// Global hata
bot.catch(async (err, ctx)=>{
  console.error("Bot error:", err);
  try { await ctx.reply("⚠️ Hata oluştu. Menüye dönüyorum."); await showRoot(ctx); } catch {}
});

bot.launch({ dropPendingUpdates: true });
console.log("Bot: iç içe menüler + bekleme durumu + emojili başlıklar.");
