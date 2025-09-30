import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import http from "http";
import https from "https";
import express from "express";

const {
  BOT_TOKEN, CHANNEL_USERNAME, APP_URL, CACHE_TTL_MS,
  BOT_WRITE_SECRET, SOCIAL_URL, SIGNUP_URL, ADMIN_NOTIFY_SECRET
} = process.env;

if (!BOT_TOKEN || !CHANNEL_USERNAME || !APP_URL) throw new Error("env missing");

const TTL = Number(CACHE_TTL_MS || 60000);

// api
const api = axios.create({
  baseURL: APP_URL, timeout: 3000,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

// bot
const bot = new Telegraf(BOT_TOKEN);

// http notify
const app = express();
app.use(express.json());
app.post("/admin/notify", async (req, res) => {
  if ((req.headers["x-admin-secret"] || "") !== (ADMIN_NOTIFY_SECRET || "")) return res.status(401).json({ error: "unauthorized" });
  const { external_id, text } = req.body || {};
  if (!external_id || !text) return res.status(400).json({ error: "required" });
  try { await bot.telegram.sendMessage(String(external_id), text, { parse_mode: "HTML" }); res.json({ ok: true }); }
  catch { res.status(500).json({ error: "send_failed" }); }
});
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`bot http on :${port}`));

// cache + helpers
const cache = new Map(); // key -> {value,exp}
const getCached = k => { const it = cache.get(k); return it && it.exp > Date.now() ? it.value : null; };
const setCached = (k, v, ttl = TTL) => cache.set(k, { value: v, exp: Date.now() + ttl });

async function fetchMessage(key) { const { data } = await api.get(`/messages/${key}`); setCached(key, data); return data; }
async function getMessage(key) { const c = getCached(key); if (c) { fetchMessage(key).catch(()=>{}); return c; } try { return await fetchMessage(key); } catch { return { content: "İçerik bulunamadı." }; } }
async function sendMessageByKey(ctx, key, extra) {
  const msg = await getMessage(key);
  const p = ctx.reply(msg.content, extra).catch(()=>{});
  if (msg.file_id) setImmediate(async()=>{ try { await ctx.replyWithPhoto(msg.file_id, { caption: msg.content }); } catch {} });
  else if (msg.image_url) setImmediate(async()=>{
    try {
      const r = await axios.get(msg.image_url, { responseType: "arraybuffer", timeout: 4000, maxRedirects: 4 });
      const sent = await ctx.replyWithPhoto({ source: Buffer.from(r.data), filename: "image" }, { caption: msg.content });
      if (sent?.photo?.length && BOT_WRITE_SECRET) {
        const fid = sent.photo[sent.photo.length - 1].file_id;
        await api.put(`/bot/messages/${key}/file-id`, { file_id: fid }, { headers: { "x-bot-secret": BOT_WRITE_SECRET } });
        setCached(key, { ...msg, file_id: fid });
      }
    } catch {}
  });
  return p;
}

async function isChannelMember(ctx) {
  try { const m = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id); return ["creator","administrator","member"].includes(m.status); }
  catch { return false; }
}
async function fetchUser(externalId) { try { const { data } = await api.get(`/users/by-external/${externalId}`); return data; } catch { return null; } }

// inline klavyeler
const kbRole = Markup.inlineKeyboard([
  [Markup.button.callback("RadissonBet Üyesiyim", "role_member")],
  [Markup.button.callback("Misafirim", "role_guest")]
]);

const kbMember = Markup.inlineKeyboard([
  [Markup.button.callback("Hesap Bilgilerimi Güncelle", "m_update")],
  [Markup.button.callback("Ücretsiz Etkinlikler ve Bonuslar", "m_free")],
  [Markup.button.callback("Bana Özel Etkinlikler ve Fırsatlar", "m_offers")],
  [Markup.button.callback("Özel Kampanyalar", "m_campaigns")],
  [Markup.button.callback("Çekilişe Katıl", "m_raffle")],
  [Markup.button.callback("Ana Menü", "go_main")]
]);

const kbGuest = Markup.inlineKeyboard([
  [Markup.button.callback("RadissonBet üyesi olmak istiyorum", "g_signup")],
  [Markup.button.callback("RadissonBet ayrıcalıkları", "g_benefits")],
  [Markup.button.callback("Etkinlikler ve fırsatlar", "g_events")],
  [Markup.button.callback("Özel Kampanyalar", "g_campaigns")],
  [Markup.button.callback("Çekilişe Katıl", "g_raffle")],
  [Markup.button.callback("Ana Menü", "go_main")]
]);

const kbJoin = Markup.inlineKeyboard([
  Markup.button.url("Kanala Katıl", `https://t.me/${CHANNEL_USERNAME.replace("@","")}`),
  Markup.button.callback("Kontrol et", "verify_join")
]);

// durum
const state = new Map(); // userId -> { stage, awaiting?, tmpMembership? }
const S = uid => { if (!state.has(uid)) state.set(uid, { stage: "welcome" }); return state.get(uid); };

// start
bot.start(async (ctx) => {
  const s = S(ctx.from.id);
  await sendMessageByKey(ctx, "welcome");
  const ok = await isChannelMember(ctx);
  if (!ok) return sendMessageByKey(ctx, "not_member", kbJoin);
  const u = await fetchUser(String(ctx.from.id));
  if (u?.membership_id) {
    s.stage = "member";
    const nameLine = [u.first_name, u.last_name].filter(Boolean).join(" ");
    if (nameLine) await ctx.reply(`Merhaba ${nameLine}`);
    return ctx.reply("Üyelik menüsü:", kbMember);
  }
  s.stage = "channel_ok";
  await ctx.reply("Lütfen bir seçenek seçin:", kbRole);
});

// kontrol et
bot.action("verify_join", async (ctx) => {
  const ok = await isChannelMember(ctx);
  await ctx.answerCbQuery(ok ? "Üyelik doğrulandı" : "Hâlâ üye görünmüyor");
  if (!ok) return;
  await ctx.editMessageText("Teşekkürler. Devam edebilirsiniz.");
  await ctx.reply("Lütfen bir seçenek seçin:", kbRole);
});

// rol seçimleri
bot.action("role_member", async (ctx) => {
  const s = S(ctx.from.id);
  s.awaiting = "membership";
  await ctx.reply("Üyelik ID’nizi girin (sadece rakam):");
});
bot.action("role_guest", async (ctx) => {
  const s = S(ctx.from.id);
  s.stage = "guest";
  await ctx.reply("Misafir menüsü:", kbGuest);
});

// text girişleri
bot.on("text", async (ctx) => {
  const s = S(ctx.from.id);
  const text = (ctx.message.text || "").trim();

  if (s.awaiting === "membership") {
    if (!/^[0-9]+$/.test(text)) return ctx.reply("Geçersiz ID. Sadece rakam girin.");
    try {
      const { data } = await api.get(`/members/${text}`);
      if (data.found) {
        await api.post(`/users`, {
          external_id: String(ctx.from.id),
          name: ctx.from.username || ctx.from.first_name || null,
          first_name: data.first_name,
          last_name: data.last_name,
          membership_id: text
        });
        s.stage = "member"; s.awaiting = undefined;
        return ctx.reply(`Merhaba ${data.first_name} ${data.last_name}. Üyelik menüsü:`, kbMember);
      } else {
        s.awaiting = "fullname"; s.tmpMembership = text;
        return ctx.reply("ID bulunamadı. Lütfen Ad Soyad yazın.");
      }
    } catch {
      return ctx.reply("Şu an doğrulama yapılamıyor.");
    }
  }

  if (s.awaiting === "fullname") {
    const full = text.replace(/\s+/g, " ").trim();
    if (!full.includes(" ")) return ctx.reply("Lütfen ad ve soyadı birlikte yazın.");
    try {
      await api.post(`/pending-requests`, {
        external_id: String(ctx.from.id),
        provided_membership_id: s.tmpMembership || null,
        full_name: full
      });
    } catch {}
    s.stage = "guest"; s.awaiting = undefined; s.tmpMembership = undefined;
    return ctx.reply("Teşekkürler. Talebiniz alındı.", kbGuest);
  }
});

// member aksiyonları
bot.action("m_update", (ctx) => ctx.reply("Hesap güncelleme yakında.", kbMember));
bot.action("m_free",   (ctx) => sendMessageByKey(ctx, "member_free_events", kbMember));
bot.action("m_offers", (ctx) => sendMessageByKey(ctx, "member_personal_offers", kbMember));
bot.action("m_campaigns", async (ctx) => {
  try {
    const { data } = await api.get("/raffles/active");
    if (!Array.isArray(data) || !data.length) return ctx.reply("Aktif kampanya yok.", kbMember);
    const rows = data.map(r => [Markup.button.callback(r.title, `raffle_join:${r.key}`)]);
    await ctx.reply("Aktif kampanyalar:", Markup.inlineKeyboard(rows));
  } catch { return ctx.reply("Kampanyalar alınamadı.", kbMember); }
});
bot.action("m_raffle", async (ctx) => {
  try {
    const { data } = await api.post("/raffle/enter", { external_id: String(ctx.from.id), raffle_key: "default_raffle" });
    if (data.joined) return sendMessageByKey(ctx, "raffle_joined", kbMember);
    if (data.reason === "already") return sendMessageByKey(ctx, "raffle_already", kbMember);
    return ctx.reply("Çekiliş aktif değil.", kbMember);
  } catch { return ctx.reply("Çekiliş kaydı yapılamadı.", kbMember); }
});

// guest aksiyonları
bot.action("g_signup", async (ctx) => {
  const kb = SIGNUP_URL ? Markup.inlineKeyboard([[Markup.button.url("Kayıt Ol", SIGNUP_URL)], [Markup.button.callback("Ana Menü","go_main")]]) : kbGuest;
  await sendMessageByKey(ctx, "guest_become_member", kb);
});
bot.action("g_benefits", async (ctx) => {
  const kb = SOCIAL_URL ? Markup.inlineKeyboard([[Markup.button.url("Radisson Sosyal", SOCIAL_URL)], [Markup.button.callback("Ana Menü","go_main")]]) : kbGuest;
  await sendMessageByKey(ctx, "guest_benefits", kb);
});
bot.action("g_events",  (ctx) => sendMessageByKey(ctx, "events", kbGuest));
bot.action("g_campaigns", async (ctx) => {
  try {
    const { data } = await api.get("/raffles/active");
    if (!Array.isArray(data) || !data.length) return ctx.reply("Aktif kampanya yok.", kbGuest);
    const rows = data.map(r => [Markup.button.callback(r.title, `raffle_join:${r.key}`)]);
    await ctx.reply("Aktif kampanyalar:", Markup.inlineKeyboard(rows));
  } catch { return ctx.reply("Kampanyalar alınamadı.", kbGuest); }
});
bot.action("g_raffle", async (ctx) => {
  try {
    const { data } = await api.post("/raffle/enter", { external_id: String(ctx.from.id), raffle_key: "default_raffle" });
    if (data.joined) return sendMessageByKey(ctx, "raffle_joined", kbGuest);
    if (data.reason === "already") return sendMessageByKey(ctx, "raffle_already", kbGuest);
    return ctx.reply("Çekiliş aktif değil.", kbGuest);
  } catch { return ctx.reply("Çekiliş kaydı yapılamadı.", kbGuest); }
});

// ortak
bot.action("go_main", async (ctx) => ctx.reply("Lütfen bir seçenek seçin:", kbRole));
bot.action(/raffle_join:.+/, async (ctx) => {
  const key = ctx.callbackQuery.data.split(":")[1];
  try {
    const { data } = await api.post("/raffle/enter", { external_id: String(ctx.from.id), raffle_key: key });
    await ctx.answerCbQuery(data.joined ? "Katılım alındı" : (data.reason === "already" ? "Zaten katıldınız" : "Pasif kampanya"));
    if (data.joined) await sendMessageByKey(ctx, "raffle_joined");
    else if (data.reason === "already") await sendMessageByKey(ctx, "raffle_already");
  } catch { await ctx.answerCbQuery("Hata"); }
});

// global hata
bot.catch(async (err, ctx) => {
  console.error("Bot error:", err);
  try { await ctx.reply("⚠️ İşlem sırasında hata oluştu. Lütfen tekrar deneyin."); } catch {}
});

bot.launch({ dropPendingUpdates: true });
console.log("Bot inline menülerle çalışıyor.");
