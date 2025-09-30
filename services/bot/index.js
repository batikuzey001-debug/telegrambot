import { Telegraf, Markup } from "telegraf";
import LocalSession from "telegraf-session-local";

const { BOT_TOKEN, CHANNEL_USERNAME } = process.env;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!CHANNEL_USERNAME) throw new Error("CHANNEL_USERNAME is required"); // Örn: @resmikanal

const bot = new Telegraf(BOT_TOKEN);

// Session middleware (dosyaya kaydeder, Railway’de ephemeral disk; yine de çalışır)
bot.use(new LocalSession({ database: "session_db.json" }).middleware());

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
    const { id } = ctx.from;
    const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, id);
    return ["creator", "administrator", "member"].includes(member.status);
  } catch {
    return false;
  }
}

async function gateOrProceed(ctx) {
  const ok = await isChannelMember(ctx);
  if (!ok) {
    await ctx.reply("Devam edebilmek için resmi kanala katılın.", joinKeyboard);
    return false;
  }
  return true;
}

bot.start(async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  if (ctx.session.membershipId) {
    await ctx.reply("Hoş geldiniz. Üyelik menüsü:", memberMenu);
  } else {
    await ctx.reply("Lütfen bir seçenek seçin:", roleMenu);
  }
});

bot.hears(["Merhaba", "merhaba", "Start", "start"], async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  if (ctx.session.membershipId) {
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

bot.hears("RadissonBet Üyesiyim", async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  ctx.session.awaitingMembershipId = true;
  await ctx.reply("Üyelik ID’nizi yazın:");
});

bot.hears("Misafirim", async (ctx) => {
  const ok = await gateOrProceed(ctx);
  if (!ok) return;
  await ctx.reply("Misafir menüsü:", guestMenu);
});

bot.on("text", async (ctx) => {
  if (ctx.session.awaitingMembershipId) {
    const idText = ctx.message.text?.trim();
    if (idText) {
      ctx.session.membershipId = idText;
      ctx.session.awaitingMembershipId = false;
      await ctx.reply("Üyelik ID’niz kaydedildi. Üyelik menüsü:", memberMenu);
    }
  }
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
console.log("Bot with channel-gate and role menus running.");
