import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import http from "http";
import https from "https";

const { BOT_TOKEN, CHANNEL_USERNAME, APP_URL, CACHE_TTL_MS } = process.env;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!CHANNEL_USERNAME) throw new Error("CHANNEL_USERNAME is required");
if (!APP_URL) throw new Error("APP_URL is required");

const TTL = Number(CACHE_TTL_MS || 60000);

// HTTP client
const httpClient = axios.create({
  baseURL: APP_URL,
  timeout: 2500,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

const bot = new Telegraf(BOT_TOKEN);

// Sabit menüler
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

// Durum
const state = new Map(); // userId -> { membershipId?: string, awaiting?: boolean }

// Basit cache
const cache = new Map(); // key -> { value:{content,image_url}, exp }

function getCached(key) {
  const it = cache.get(key);
  return it && it.exp > Date.now() ? it.value : null;
}
function setCached(key, value, ttl = TTL) {
  cache.set(key, { value, exp: Date.now() + ttl });
}
async function fetchMessage(key) {
  const { data } = await httpClient.get(`/messages/${key}`);
  setCached(key, data);
  return data;
}
async function getMessage(key) {
  const c = getCached(key);
  if (c) {
    fetchMessage(key).catch(() => {});
    return c;
  }
  try {
    return await fetchMessage(key);
  } catch {
    return { content: "İçerik bulunamadı.", image_url: null };
  }
}

// Ortak gönderici: image varsa fotoğraf + caption, yoksa düz metin
async function sendMessageByKey(ctx, key, extraKb) {
  const msg = await getMessage(key);
  if (msg.image_url) {
    return ctx.replyWithPhoto(msg.image_url, { caption: msg.content, ...extraKb });
  }
  return ctx.reply(msg.content, extraKb);
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
    await sendMessageByKey(ctx, "not_member", { reply_markup: joinKeyboard.reply_markup });
    return false;
  }
  return true;
}
function getUserState(uid) { if (!state.has(uid)) state.set(uid, {}); return state.get(uid); }

// Start
bot.start(async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  const s = getUserState(ctx.from.id);
  await sendMessageByKey(ctx, "welcome");
  if (s.membershipId) await ctx.reply("Üyelik menüsü:", memberMenu);
  else await ctx.reply("Lütfen bir seçenek seçin:", roleMenu);
});

// Selam
bot.hears(["Merhaba", "merhaba", "Start", "start"], async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  await sendMessageByKey(ctx, "welcome");
  const s = getUserState(ctx.from.id);
  await ctx.reply("Menü:", s.membershipId ? memberMenu : guestMenu);
});

// Kanal kontrol
bot.action("verify_join", async (ctx) => {
  const ok = await isChannelMember(ctx);
  await ctx.answerCbQuery(ok ? "Üyelik doğrulandı" : "Hâlâ üye görünmüyor");
  if (!ok) return;
  await ctx.editMessageText("Teşekkürler. Devam edebilirsiniz.");
  await sendMessageByKey(ctx, "welcome");
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

// Üyelik ID kaydet
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

// Menü eylemleri → mesaj anahtarları
bot.hears("Etkinlikler ve fırsatlar", (ctx) => sendMessageByKey(ctx, "events"));
bot.hears("RadissonBet üyesi olmak istiyorum", (ctx) => sendMessageByKey(ctx, "guest_become_member"));
bot.hears("RadissonBet ayrıcalıkları", (ctx) => sendMessageByKey(ctx, "guest_benefits"));
bot.hears("Hesap Bilgilerimi Güncelle", (ctx) => sendMessageByKey(ctx, "member_update_account"));
bot.hears("Ücretsiz Etkinlikler ve Bonuslar", (ctx) => sendMessageByKey(ctx, "member_free_events"));
bot.hears("Bana Özel Etkinlikler ve Fırsatlar", (ctx) => sendMessageByKey(ctx, "member_personal_offers"));

bot.launch();
console.log("Bot sending images when image_url exists.");
