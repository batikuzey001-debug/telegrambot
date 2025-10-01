// services/bot/index.js
import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import http from "http";
import https from "https";
import express from "express";

const {
  BOT_TOKEN, CHANNEL_USERNAME, APP_URL,
  CACHE_TTL_MS, BOT_WRITE_SECRET,
  SOCIAL_URL, SIGNUP_URL, ADMIN_NOTIFY_SECRET,
  CACHE_SECRET, PORT
} = process.env;

if (!BOT_TOKEN || !CHANNEL_USERNAME || !APP_URL) throw new Error("missing env");

const TTL = Number(CACHE_TTL_MS || 60000);

/* ---------------- HTTP client (API) ---------------- */
const api = axios.create({
  baseURL: APP_URL,
  timeout: 3000,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

/* ---------------- Bot ---------------- */
const bot = new Telegraf(BOT_TOKEN);

/* ---------------- In-process cache (messages) ---------------- */
const cache = new Map();
const getCached = (k) => {
  const it = cache.get(k);
  return it && it.exp > Date.now() ? it.value : null;
};
const setCached = (k, v, ttl = TTL) => cache.set(k, { value: v, exp: Date.now() + ttl });

/* ---------------- Helpers ---------------- */
async function fetchMessage(key) {
  const { data } = await api.get(`/messages/${key}`);
  setCached(key, data);
  return data;
}
async function getMessage(key) {
  const c = getCached(key);
  if (c) { fetchMessage(key).catch(() => {}); return c; }
  try { return await fetchMessage(key); }
  catch { return { content: "İçerik bulunamadı.", image_url: null, file_id: null }; }
}

async function getStatus(externalId) {
  try { const { data } = await api.get(`/users/status/${externalId}`); return data; }
  catch { return { stage: "guest" }; }
}

function buildName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
}
function personalize(st, text) {
  if (st?.stage !== "member") return text;
  const name = buildName(st.user || {});
  if (!name) return text;
  return `Sayın ${name},\n\n${text}`;
}

/* ---------------- Send by key ---------------- */
async function sendMessageByKey(ctx, key, extra, stOpt) {
  const st = stOpt || await getStatus(String(ctx.from.id));
  const msg = await getMessage(key);
  const content = personalize(st, msg.content);

  if (msg.file_id) return ctx.replyWithPhoto(msg.file_id, { caption: content, ...extra });

  if (msg.image_url) {
    try {
      const r = await axios.get(msg.image_url, { responseType: "arraybuffer", timeout: 4000, maxRedirects: 4 });
      const sent = await ctx.replyWithPhoto(
        { source: Buffer.from(r.data), filename: "image" },
        { caption: content, ...extra }
      );
      if (sent?.photo?.length && BOT_WRITE_SECRET) {
        const fid = sent.photo[sent.photo.length - 1].file_id;
        await api.put(`/bot/messages/${key}/file-id`, { file_id: fid }, { headers: { "x-bot-secret": BOT_WRITE_SECRET } });
        setCached(key, { ...msg, file_id: fid });
      }
      return sent;
    } catch {
      return ctx.reply(content, extra);
    }
  }
  return ctx.reply(content, extra);
}

/* ---------------- Membership helpers ---------------- */
async function isChannelMember(ctx) {
  try { const m = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id); return ["creator","administrator","member"].includes(m.status); }
  catch { return false; }
}

/* ---------------- Keyboards ---------------- */
const KB = {
  ROOT: Markup.inlineKeyboard([[Markup.button.callback("👤 RadissonBet Üyesiyim","role_member")],[Markup.button.callback("🙋‍♂️ Misafirim","role_guest")]]),
  MEMBER_HOME: Markup.inlineKeyboard([
    [Markup.button.callback("🧾 Hesap Bilgilerim","m_account")],
    [Markup.button.callback("🎁 Ücretsiz Etkinlikler","m_free")],
    [Markup.button.callback("⭐ Bana Özel Fırsatlar","m_offers")],
    [Markup.button.callback("📢 Özel Kampanyalar","m_campaigns")],
    [Markup.button.callback("🎟️ Çekilişler","m_raffle")],
    [Markup.button.callback("🏠 Ana Menü","go_root")]
  ]),
  GUEST_HOME: Markup.inlineKeyboard([
    [Markup.button.callback("📝 Üye Ol","g_signup")],
    [Markup.button.callback("🏅 Radisson Ayrıcalıkları","g_benefits")],
    [Markup.button.callback("📅 Etkinlikler ve Fırsatlar","g_events")],
    [Markup.button.callback("📢 Özel Kampanyalar","g_campaigns")],
    [Markup.button.callback("🏠 Ana Menü","go_root")]
  ]),
  PENDING_HOME: Markup.inlineKeyboard([[Markup.button.callback("🔄 Durumu Yenile","p_refresh")],[Markup.button.callback("🏠 Ana Menü","go_root")]])
};

/* ---------------- State ---------------- */
const state = new Map();
const S = (uid)=>{ if(!state.has(uid)) state.set(uid,{ stage:"ROOT" }); return state.get(uid); };
const lastStart = new Map();

/* ---------------- Render ---------------- */
const showRoot   = (ctx)=> ctx.reply("👇 Lütfen bir seçenek seçin:", KB.ROOT);
const showMember = (ctx,n)=> ctx.reply(n?`👋 Merhaba ${n}\n🧭 Üyelik menüsü:`:"🧭 Üyelik menüsü:", KB.MEMBER_HOME);
const showGuest  = (ctx)=> ctx.reply("🧭 Misafir menüsü:", KB.GUEST_HOME);
const showPending= (ctx)=> ctx.reply("⏳ Başvurunuz inceleniyor. Onaylanınca üyelik ana sayfanız açılacak.", KB.PENDING_HOME);

/* ---------------- Router ---------------- */
async function routeHome(ctx){
  const st = await getStatus(String(ctx.from.id));
  if (st.stage === "member") return showMember(ctx, buildName(st.user||{}));
  if (st.stage === "pending") return showPending(ctx);
  return showRoot(ctx);
}

/* ---------------- Start ---------------- */
bot.start(async (ctx)=>{
  const now=Date.now(), prev=lastStart.get(ctx.from.id)||0;
  if (now-prev<1500) return;
  lastStart.set(ctx.from.id, now);

  const payload = ctx.startPayload;
  if (payload === "go_member") {
    const st = await getStatus(String(ctx.from.id));
    if (st.stage === "member") return showMember(ctx, buildName(st.user||{}));
  }

  const st = await getStatus(String(ctx.from.id));
  await sendMessageByKey(ctx,"welcome",undefined,st);
  const ok = await isChannelMember(ctx);
  if (!ok) return sendMessageByKey(ctx,"not_member",KB.ROOT,st);
  return routeHome(ctx);
});

/* ---------------- Registration + other actions (unchanged handlers) ---------------- */
// role_member, text, confirm_yes/no/restart, p_refresh, guest/member actions, raffle, etc.
// (Sizdeki mevcut handler’lar aynı şekilde kalır)

/* ---------------- Unknown callback -> home ---------------- */
bot.on("callback_query", async (ctx, next) => {
  const d = ctx.callbackQuery?.data || "";
  const known = /^(role_|g_|m_|go_|p_refresh|confirm_|raffle_join:)/.test(d);
  if (!known) { await ctx.answerCbQuery("⚠️ Geçersiz seçim").catch(() => {}); return routeHome(ctx); }
  return next();
});

/* ---------------- Global error ---------------- */
bot.catch(async (err, ctx) => {
  console.error("Bot error:", err);
  try { await ctx.reply("⚠️ Hata oluştu. Menüye dönüyorum."); await routeHome(ctx); } catch {}
});

/* ---------------- Minimal HTTP (invalidate + notify) ---------------- */
const httpApp = express();
httpApp.use(express.json());
httpApp.get("/", (_req, res) => res.json({ ok: true, service: "bot" }));

// UPDATED: buttons + image_url destekler
httpApp.post("/admin/notify", async (req, res) => {
  if ((req.headers["x-admin-secret"] || "") !== (ADMIN_NOTIFY_SECRET || "")) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { external_id, text, buttons, image_url } = req.body || {};
  if (!external_id || !text) return res.status(400).json({ error: "required" });

  let reply_markup;
  if (Array.isArray(buttons) && buttons.length) {
    const rows = buttons.filter(b => b && b.text && b.url).map(b => [{ text: String(b.text), url: String(b.url) }]);
    if (rows.length) reply_markup = { inline_keyboard: rows };
  }

  try {
    if (image_url) {
      await bot.telegram.sendPhoto(String(external_id), image_url, { caption: text, parse_mode: "HTML", reply_markup });
    } else {
      await bot.telegram.sendMessage(String(external_id), text, { parse_mode: "HTML", reply_markup });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error("[ADMIN NOTIFY ERR]", e?.message || e);
    return res.status(500).json({ error: "send_failed" });
  }
});

httpApp.post("/invalidate", (req, res) => {
  if ((req.headers["x-cache-secret"] || "") !== (CACHE_SECRET || "")) return res.status(401).json({ error: "unauthorized" });
  const { key } = req.body || {};
  if (key) cache.delete(key); else cache.clear();
  return res.json({ ok: true });
});

httpApp.listen(Number(PORT || 3001), () => console.log(`bot http on :${Number(PORT || 3001)}`));

/* ---------------- Launch ---------------- */
async function bootstrap() {
  try {
    try {
      const del = await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      console.log("deleteWebhook:", del);
    } catch (e) {
      console.log("deleteWebhook err:", e?.message);
    }
    await bot.launch({ dropPendingUpdates: true });
    console.log("BOT LAUNCHED with token tail:", (BOT_TOKEN || "").slice(-6));
  } catch (e) {
    console.error("Launch error:", e);
    process.exit(1);
  }
}
bootstrap();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
