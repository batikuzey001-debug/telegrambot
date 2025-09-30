import { Telegraf, Markup } from "telegraf";

const { BOT_TOKEN } = process.env;
if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN environment variable is required");
}

const bot = new Telegraf(BOT_TOKEN);

// Menü seçenekleri
const menu = Markup.keyboard([
  ["Çekilişe Katıl"],
  ["Etkinlikleri Gör"],
  ["Hesap Bilgilerini Güncelle"]
]).resize();

bot.start((ctx) => ctx.reply("Merhaba, hoş geldiniz!", menu));
bot.hears(["Merhaba", "merhaba"], (ctx) =>
  ctx.reply("Merhaba, hoş geldiniz!", menu)
);

// Menü cevapları
bot.hears("Çekilişe Katıl", (ctx) =>
  ctx.reply("Çekilişe katılımınız alındı (dummy mesaj).")
);
bot.hears("Etkinlikleri Gör", (ctx) =>
  ctx.reply("Şu an etkinlik listesi boş (dummy mesaj).")
);
bot.hears("Hesap Bilgilerini Güncelle", (ctx) =>
  ctx.reply("Hesap bilgilerini güncelleme yakında aktif olacak.")
);

bot.launch();
console.log("Bot with static menu running...");
