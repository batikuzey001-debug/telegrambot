import { Telegraf } from "telegraf";

const { BOT_TOKEN } = process.env;
if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN environment variable is required");
}

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => ctx.reply("Merhaba, hoş geldiniz!"));
bot.hears(["Merhaba", "merhaba"], (ctx) => ctx.reply("Merhaba, hoş geldiniz!"));

bot.launch();
console.log("Bot skeleton running...");
