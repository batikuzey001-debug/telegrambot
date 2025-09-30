import { Telegraf, Markup } from "telegraf";
import axios from "axios";

const { BOT_TOKEN, CHANNEL_USERNAME, APP_URL } = process.env;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!CHANNEL_USERNAME) throw new Error("CHANNEL_USERNAME is required");
if (!APP_URL) throw new Error("APP_URL is required");

const state = new Map(); // { membershipId?, awaiting? }
const bot = new Telegraf(BOT_TOKEN);

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
    const { data } = await axios.get(`${APP_URL}/messages/not_member`).catch(() => ({ data: { content: "Devam için resmi kanala katılın." } }));
    await ctx.reply(data.content, joinKeyboard);
    return false;
  }
  return true;
}
function getUserState(uid) { if (!state.has(uid)) state.set(uid, {}); return state.get(uid); }

async function getWelcome() {
  try { const { data } = await axios.get(`${APP_URL}/messages/welcome`); return data.content; }
  catch { return "Merhaba, hoş geldiniz!"; }
}
async function getMenu(role) {
  try { const { data } = await axios.get(`${APP_URL}/menu`, { params: { role } }); return data; }
  catch { return []; }
}
function toKeyboard(items) {
  if (!items.length) return undefined;
  return Markup.keyboard(items.map(i => [i.title])).resize();
}

async function sendRoleMenu(ctx) {
  const s = getUserState(ctx.from.id);
  const role = s.membershipId ? "member" : "guest";
  const items = await getMenu(role);
  const kb = toKeyboard(items);
  await ctx.reply("Menü:", kb);
}

bot.start(async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  const welcome = await getWelcome();
  const s = getUserState(ctx.from.id);
  await ctx.reply(welcome);
  if (s.membershipId) await sendRoleMenu(ctx);
  else {
    await ctx.reply("Lütfen bir seçenek seçin:", Markup.keyboard([["RadissonBet Üyesiyim"], ["Misafirim"]]).resize());
  }
});

bot.hears(["Merhaba", "merhaba", "Start", "start"], async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  const welcome = await getWelcome();
  await ctx.reply(welcome);
  await sendRoleMenu(ctx);
});

bot.action("verify_join", async (ctx) => {
  const ok = await isChannelMember(ctx);
  await ctx.answerCbQuery(ok ? "Üyelik doğrulandı" : "Hâlâ üye görünmüyor");
  if (!ok) return;
  await ctx.editMessageText("Teşekkürler. Devam edebilirsiniz.");
  const welcome = await getWelcome();
  await ctx.reply(welcome);
  await ctx.reply("Lütfen bir seçenek seçin:", Markup.keyboard([["RadissonBet Üyesiyim"], ["Misafirim"]]).resize());
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
  await sendRoleMenu(ctx); // guest menü
});

// Üyelik ID yakalama ve API'ye kaydetme
bot.on("text", async (ctx) => {
  const s = getUserState(ctx.from.id);
  if (!s.awaiting) return;
  const idText = ctx.message.text?.trim();
  if (!idText) return;
  s.membershipId = idText;
  s.awaiting = false;

  try {
    await axios.post(`${APP_URL}/users`, {
      external_id: String(ctx.from.id),
      name: ctx.from.username || ctx.from.first_name || null,
      membership_id: idText
    });
  } catch (e) {
    console.error("Save user error:", e?.message);
  }

  await ctx.reply("Üyelik ID’niz kaydedildi.");
  await sendRoleMenu(ctx); // member menü
});

// Basit aksiyon örnekleri
bot.hears("Hesap Bilgilerimi Güncelle", (ctx) => ctx.reply("Hesap güncelleme yakında aktif olacak."));
bot.hears("Ücretsiz Etkinlikler ve Bonuslar", (ctx) => ctx.reply("Şu an ücretsiz etkinlik bulunmuyor."));
bot.hears("Bana Özel Etkinlikler ve Fırsatlar", (ctx) => ctx.reply("Yakında sunulacak."));
bot.hears("RadissonBet üyesi olmak istiyorum", (ctx) => ctx.reply("Kayıt bağlantısı yakında."));
bot.hears("RadissonBet ayrıcalıkları", (ctx) => ctx.reply("Ayrıcalıklar listesi yakında."));
bot.hears("Etkinlikler ve fırsatlar", (ctx) => ctx.reply("Genel etkinlikler yakında."));

bot.launch();
console.log("Bot using dynamic messages and menus.");
