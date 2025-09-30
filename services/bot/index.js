import { Telegraf, Markup } from "telegraf";
import axios from "axios";

const { BOT_TOKEN, CHANNEL_USERNAME, APP_URL } = process.env;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!CHANNEL_USERNAME) throw new Error("CHANNEL_USERNAME is required");
if (!APP_URL) throw new Error("APP_URL is required");

// Basit bellek içi durum
const state = new Map(); // key: userId, value: { membershipId?: string, awaiting?: boolean }

const bot = new Telegraf(BOT_TOKEN);

const joinKeyboard = Markup.inlineKeyboard([
  Markup.button.url("Kanala Katıl", `https://t.me/${CHANNEL_USERNAME.replace("@", "")}`),
  Markup.button.callback("Kontrol et", "verify_join")
]);

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
    await ctx.reply("Devam için resmi kanala katılın.", joinKeyboard);
    return false;
  }
  return true;
}

function getUserState(userId) {
  if (!state.has(userId)) state.set(userId, {});
  return state.get(userId);
}

bot.start(async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  const s = getUserState(ctx.from.id);
  if (s.membershipId) {
    await ctx.reply("Hoş geldiniz. Üyelik menüsü:", memberMenu);
  } else {
    await ctx.reply("Lütfen bir seçenek seçin:", roleMenu);
  }
});

bot.hears(["Merhaba", "merhaba", "Start", "start"], async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  const s = getUserState(ctx.from.id);
  if (s.membershipId) {
    await ctx.reply("Hoş geldiniz. Üyelik menüsü:", memberMenu);
  } else {
    await ctx.reply("Lütfen bir seçenek seçin:", roleMenu);
  }
});

bot.action("verify_join", async (ctx) => {
  const ok = await isChannelMember(ctx);
  await ctx.answerCbQuery(ok ? "Üyelik doğrulandı" : "Hâlâ üye görünmüyor");
  if (!ok) return;
  await ctx.editMessageText("Teşekkürler. Devam edebilirsiniz.");
  await ctx.reply("Lütfen bir seçenek seçin:", roleMenu);
});

// Rol seçimi
bot.hears("RadissonBet Üyesiyim", async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  const s = getUserState(ctx.from.id);
  s.awaiting = true; // sadece sıradaki mesaj için bekleme
  await ctx.reply("Üyelik ID’nizi yazın:");
});

bot.hears("Misafirim", async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  await ctx.reply("Misafir menüsü:", guestMenu);
});

// Üyelik ID yakalama
bot.on("text", async (ctx) => {
  const s = getUserState(ctx.from.id);
  if (!s.awaiting) return;

  const idText = ctx.message.text?.trim();
  if (!idText) return;

  s.membershipId = idText;
  s.awaiting = false;

  // Kalıcı kayıt
  try {
    await axios.post(`${APP_URL}/users`, {
      external_id: String(ctx.from.id),
      name: ctx.from.username || ctx.from.first_name || null,
      membership_id: idText
    });
  } catch (err) {
    console.error("API user save error:", err.message);
  }

  await ctx.reply("Üyelik ID’niz kaydedildi. Üyelik menüsü:", memberMenu);
});

// Üye menüsü (dummy)
bot.hears("Hesap Bilgilerimi Güncelle", (ctx) =>
  ctx.reply("Hesap güncelleme yakında aktif olacak.")
);
bot.hears("Ücretsiz Etkinlikler ve Bonuslar", (ctx) =>
  ctx.reply("Şu an ücretsiz etkinlik bulunmuyor.")
);
bot.hears("Bana Özel Etkinlikler ve Fırsatlar", (ctx) =>
  ctx.reply("Size özel fırsatlar yakında sunulacak.")
);

// Misafir menüsü (dummy)
bot.hears("RadissonBet üyesi olmak istiyorum", (ctx) =>
  ctx.reply("Kayıt bağlantısı yakında eklenecek.")
);
bot.hears("RadissonBet ayrıcalıkları", (ctx) =>
  ctx.reply("Ayrıcalıklar listesi yakında eklenecek.")
);
bot.hears("Etkinlikler ve fırsatlar", (ctx) =>
  ctx.reply("Genel etkinlik listesi yakında eklenecek.")
);

bot.launch();
console.log("Bot running without session middleware.");
