import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import http from "http";
import https from "https";
import express from "express";

const { BOT_TOKEN, CHANNEL_USERNAME, APP_URL, CACHE_TTL_MS, CACHE_SECRET } = process.env;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!CHANNEL_USERNAME) throw new Error("CHANNEL_USERNAME is required");
if (!APP_URL) throw new Error("APP_URL is required");

const TTL = Number(CACHE_TTL_MS || 60000);

// HTTP client: hızlı
const httpClient = axios.create({
  baseURL: APP_URL,
  timeout: 2500,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

const bot = new Telegraf(BOT_TOKEN);

// Sabit menüler (hız için kod içinde)
const roleMenu = Markup.keyboard([["RadissonBet Üyesiyim"], ["Misafirim"]]).resize();
const memberMenu = Markup.keyboard([
  ["Hesap Bilgilerimi Güncelle"],
  ["Ücretsiz Etkinlikler ve Bonuslar"],
  ["Bana Özel Etkinlikler ve Fırsatlar"]
]).resize();
const guestMenu = Markup.keyboard([
  ["RadissonBet üyesi olmak istiyorum"],
  ["RadissonBet ayrıcalıkları"],
  ["Etkinlikler ve fırsatlar"]
]).resize();

// Basit durum belleği
const state = new Map(); // userId -> { verified?: boolean, membershipId?: string, awaiting?: boolean }

// Basit cache (mesaj içerikleri için)
const cache = new Map(); // key -> { value: {content,image_url}, exp: number }

function getCached(key) {
  const item = cache.get(key);
  if (item && item.exp > Date.now()) return item.value;
  return null;
}
function setCached(key, value, ttlMs = TTL) {
  cache.set(key, { value, exp: Date.now() + ttlMs });
}
async function fetchMessage(key, bg = false) {
  try {
    const { data } = await httpClient.get(`/messages/${key}`);
    setCached(key, data);
    return data;
  } catch {
    if (!bg) return { content: key === "not_member" ? "Devam için resmi kanala katılın." : "Metin bulunamadı." };
    return null;
  }
}
async function getMessageFast(key) {
  const c = getCached(key);
  if (c) {
    // stale-while-revalidate: arka planda yenile
    fetchMessage(key, true);
    return c;
  }
  return await fetchMessage(key);
}

const joinKeyboard = Markup.inlineKeyboard([
  Markup.button.url("Kanala Katıl", `https://t.me/${CHANNEL_USERNAME.replace("@", "")}`),
  Markup.button.callback("Kontrol et", "verify_join")
]);

async function isChannelMember(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
    return ["creator", "administrator", "member"].includes(member.status);
  } catch {
    return false;
  }
}
async function gateOrProceed(ctx) {
  const ok = await isChannelMember(ctx);
  if (!ok) {
    const data = await getMessageFast("not_member");
    await ctx.reply(data.content, joinKeyboard);
    return false;
  }
  return true;
}
function getUserState(uid) { if (!state.has(uid)) state.set(uid, {}); return state.get(uid); }

bot.start(async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  const welcome = await getMessageFast("welcome");
  const s = getUserState(ctx.from.id);
  await ctx.reply(welcome.content);
  if (s.membershipId) await ctx.reply("Üyelik menüsü:", memberMenu);
  else await ctx.reply("Lütfen bir seçenek seçin:", roleMenu);
});

bot.hears(["Merhaba", "merhaba", "Start", "start"], async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  const welcome = await getMessageFast("welcome");
  await ctx.reply(welcome.content);
  const s = getUserState(ctx.from.id);
  await ctx.reply("Menü:", s.membershipId ? memberMenu : guestMenu);
});

bot.action("verify_join", async (ctx) => {
  const ok = await isChannelMember(ctx);
  await ctx.answerCbQuery(ok ? "Üyelik doğrulandı" : "Hâlâ üye görünmüyor");
  if (!ok) return;
  await ctx.editMessageText("Teşekkürler. Devam edebilirsiniz.");
  const welcome = await getMessageFast("welcome");
  await ctx.reply(welcome.content);
  await ctx.reply("Lütfen bir seçenek seçin:", roleMenu);
});

// Rol seçimi
bot.hears("RadissonBet Üyesiyim", async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  const s = getUserState(ctx.from.id);
  s.awaiting = true;
  await ctx.reply("Üyelik ID’nizi yazın:");
});

bot.hears("Misafirim", async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  await ctx.reply("Misafir menüsü:", guestMenu);
});

// Üyelik ID yakalama ve kalıcı kaydetme
bot.on("text", async (ctx) => {
  const s = getUserState(ctx.from.id);
  if (!s.awaiting) return;
  const idText = ctx.message.text?.trim();
  if (!idText) return;

  s.membershipId = idText;
  s.awaiting = false;

  try {
    await httpClient.post(`/users`, {
      external_id: String(ctx.from.id),
      name: ctx.from.username || ctx.from.first_name || null,
      membership_id: idText
    });
  } catch (e) {
    console.error("Save user error:", e?.message);
  }

  await ctx.reply("Üyelik ID’niz kaydedildi. Üyelik menüsü:", memberMenu);
});

// İçerik örneği: API’den metin + görsel hızlı
bot.hears("Etkinlikler ve fırsatlar", async (ctx) => {
  const data = await getMessageFast("events");
  if (data.image_url) {
    await ctx.replyWithPhoto(data.image_url, { caption: data.content });
  } else {
    await ctx.reply(data.content);
  }
});

// Diğer buton örnekleri (sabit metin, hızlı)
bot.hears("Hesap Bilgilerimi Güncelle", (ctx) => ctx.reply("Hesap güncelleme yakında."));
bot.hears("Ücretsiz Etkinlikler ve Bonuslar", (ctx) => ctx.reply("Şu an ücretsiz etkinlik yok."));
bot.hears("Bana Özel Etkinlikler ve Fırsatlar", (ctx) => ctx.reply("Yakında sunulacak."));
bot.hears("RadissonBet üyesi olmak istiyorum", (ctx) => ctx.reply("Kayıt bağlantısı yakında."));
bot.hears("RadissonBet ayrıcalıkları", (ctx) => ctx.reply("Ayrıcalıklar listesi yakında."));

// ---- Invalidate endpoint (Backoffice tetikler) ----
const app = express();
app.use(express.json());
app.post("/invalidate", (req, res) => {
  if ((req.headers["x-cache-secret"] || "") !== CACHE_SECRET) return res.status(401).json({ error: "unauthorized" });
  const { key } = req.body || {};
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
  res.json({ ok: true });
});

// Bot long-polling + küçük HTTP sunucu
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`bot http on :${port}`));
bot.launch();
console.log("Bot with fast cache and invalidate endpoint running.");
