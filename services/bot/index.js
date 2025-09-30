import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import http from "http";
import https from "https";
import express from "express";

const {
  BOT_TOKEN,
  CHANNEL_USERNAME,
  APP_URL,
  CACHE_TTL_MS,
  BOT_WRITE_SECRET,
  SOCIAL_URL,
  SIGNUP_URL,
  ADMIN_NOTIFY_SECRET
} = process.env;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!CHANNEL_USERNAME) throw new Error("CHANNEL_USERNAME is required");
if (!APP_URL) throw new Error("APP_URL is required");

const TTL = Number(CACHE_TTL_MS || 60000);

// API client
const api = axios.create({
  baseURL: APP_URL,
  timeout: 3000,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

// Telegraf
const bot = new Telegraf(BOT_TOKEN);

// Mini HTTP (admin notify)
const app = express();
app.use(express.json());
app.post("/admin/notify", async (req, res) => {
  if ((req.headers["x-admin-secret"] || "") !== (ADMIN_NOTIFY_SECRET || "")) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { external_id, text } = req.body || {};
  if (!external_id || !text) return res.status(400).json({ error: "required" });
  try {
    await bot.telegram.sendMessage(String(external_id), text, { parse_mode: "HTML" });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "send_failed" });
  }
});
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`bot http on :${port}`));

// Klavyeler
const backRow = ["Geri", "Ana Menü"];
const roleChoiceKb = Markup.keyboard([["RadissonBet Üyesiyim"], ["Misafirim"]]).resize();
const memberMenu = Markup.keyboard(
  [["Hesap Bilgilerimi Güncelle"],
   ["Ücretsiz Etkinlikler ve Bonuslar"],
   ["Bana Özel Etkinlikler ve Fırsatlar"],
   ["Özel Kampanyalar"],
   ["Çekilişe Katıl"],
   backRow]
).resize();
const guestMenu  = Markup.keyboard(
  [["RadissonBet üyesi olmak istiyorum"],
   ["RadissonBet ayrıcalıkları"],
   ["Etkinlikler ve fırsatlar"],
   ["Özel Kampanyalar"],
   ["Çekilişe Katıl"],
   backRow]
).resize();

const joinKeyboard = Markup.inlineKeyboard([
  Markup.button.url("Kanala Katıl", `https://t.me/${CHANNEL_USERNAME.replace("@","")}`),
  Markup.button.callback("Kontrol et", "verify_join")
]);

// Durum + cache
const state = new Map(); // userId -> { stage, awaiting?, tmpMembership? }
const cache = new Map(); // key -> { value, exp }
const getCached = (k)=>{const it=cache.get(k);return it&&it.exp>Date.now()?it.value:null;};
const setCached = (k,v,ttl=TTL)=>cache.set(k,{value:v,exp:Date.now()+ttl});

async function fetchMessage(key){
  const { data } = await api.get(`/messages/${key}`);
  setCached(key, data);
  return data;
}
async function getMessage(key){
  const c = getCached(key);
  if (c) { fetchMessage(key).catch(()=>{}); return c; }
  try { return await fetchMessage(key); }
  catch { return { content: "İçerik bulunamadı." }; }
}
async function sendMessageByKey(ctx, key, extraKb){
  const msg = await getMessage(key);
  const textP = ctx.reply(msg.content, extraKb).catch(()=>{});
  if (msg.file_id) {
    setImmediate(async()=>{ try{ await ctx.replyWithPhoto(msg.file_id, { caption: msg.content }); }catch{} });
  } else if (msg.image_url) {
    setImmediate(async()=>{ try{
      const r = await axios.get(msg.image_url,{ responseType:"arraybuffer", timeout:4000, maxRedirects:4 });
      const sent = await ctx.replyWithPhoto({ source:Buffer.from(r.data), filename:"image" }, { caption: msg.content });
      if (sent?.photo?.length && BOT_WRITE_SECRET) {
        const fid = sent.photo[sent.photo.length - 1].file_id;
        await api.put(`/bot/messages/${key}/file-id`, { file_id: fid }, { headers: { "x-bot-secret": BOT_WRITE_SECRET } });
        setCached(key, { ...msg, file_id: fid });
      }
    }catch{} });
  }
  return textP;
}

async function isChannelMember(ctx){
  try {
    const m = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
    return ["creator","administrator","member"].includes(m.status);
  } catch { return false; }
}
function S(uid){ if(!state.has(uid)) state.set(uid,{ stage:"welcome" }); return state.get(uid); }

// DB: kullanıcıyı getir
async function fetchUserByExternal(externalId){
  try {
    const { data } = await api.get(`/users/by-external/${externalId}`);
    return data; // { id, external_id, first_name, last_name, membership_id }
  } catch { return null; }
}

// ---- Akış ----
// /start: hoş geldin → kanal kontrol → DB’de üyelik varsa Üye menüsü, yoksa rol seçimi
bot.start(async (ctx)=>{
  const s = S(ctx.from.id);
  await sendMessageByKey(ctx,"welcome");
  const ok = await isChannelMember(ctx);
  if (!ok) {
    s.stage = "welcome";
    await sendMessageByKey(ctx,"not_member",{ reply_markup: joinKeyboard.reply_markup });
    return;
  }
  const u = await fetchUserByExternal(String(ctx.from.id));
  if (u?.membership_id) {
    s.stage = "member";
    const nameLine = [u.first_name, u.last_name].filter(Boolean).join(" ");
    if (nameLine) await ctx.reply(`Merhaba ${nameLine}`);
    return ctx.reply("Üyelik menüsü:", memberMenu);
  }
  s.stage = "channel_ok";
  await ctx.reply("Lütfen bir seçenek seçin:", roleChoiceKb);
});

// “Kontrol et” → rol seçimi
bot.action("verify_join", async (ctx)=>{
  const s = S(ctx.from.id);
  const ok = await isChannelMember(ctx);
  await ctx.answerCbQuery(ok ? "Üyelik doğrulandı" : "Hâlâ üye görünmüyor");
  if (!ok) return;
  s.stage = "channel_ok";
  await ctx.editMessageText("Teşekkürler. Devam edebilirsiniz.");
  await ctx.reply("Lütfen bir seçenek seçin:", roleChoiceKb);
});

// Selam tetikleri → /start ile aynı
bot.hears(["Merhaba","merhaba","Start","start"], async (ctx)=>{
  const s = S(ctx.from.id);
  await sendMessageByKey(ctx,"welcome");
  const ok = await isChannelMember(ctx);
  if (!ok) {
    s.stage = "welcome";
    return sendMessageByKey(ctx,"not_member",{ reply_markup: joinKeyboard.reply_markup });
  }
  const u = await fetchUserByExternal(String(ctx.from.id));
  if (u?.membership_id) {
    s.stage = "member";
    const nameLine = [u.first_name, u.last_name].filter(Boolean).join(" ");
    if (nameLine) await ctx.reply(`Merhaba ${nameLine}`);
    return ctx.reply("Üyelik menüsü:", memberMenu);
  }
  s.stage = "channel_ok";
  await ctx.reply("Lütfen bir seçenek seçin:", roleChoiceKb);
});

// Rol seçimi
bot.hears("RadissonBet Üyesiyim", async (ctx)=>{
  const s = S(ctx.from.id);
  if (s.stage!=="channel_ok" && s.stage!=="guest" && s.stage!=="member")
    return ctx.reply("Önce kanala katılımı tamamlayın.");
  s.awaiting = "membership";
  await ctx.reply("Üyelik ID’nizi girin (sadece rakam):");
});

bot.hears("Misafirim", async (ctx)=>{
  const s = S(ctx.from.id);
  if (s.stage!=="channel_ok" && s.stage!=="guest" && s.stage!=="member")
    return ctx.reply("Önce kanala katılımı tamamlayın.");
  s.stage = "guest";
  await ctx.reply("Misafir menüsü:", guestMenu);
});

// Üyelik ID / Ad Soyad
bot.on("text", async (ctx)=>{
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
        s.stage = "member";
        s.awaiting = undefined;
        return ctx.reply(`Merhaba ${data.first_name} ${data.last_name}. Üyelik menüsü:`, memberMenu);
      } else {
        s.awaiting = "fullname";
        s.tmpMembership = text;
        return ctx.reply("ID bulunamadı. Lütfen Ad Soyad yazın.");
      }
    } catch {
      return ctx.reply("Şu an doğrulama yapılamıyor.");
    }
  }

  if (s.awaiting === "fullname") {
    const full = text.replace(/\s+/g," ").trim();
    if (!full.includes(" ")) return ctx.reply("Lütfen ad ve soyadı birlikte yazın.");
    try {
      await api.post(`/pending-requests`, {
        external_id: String(ctx.from.id),
        provided_membership_id: s.tmpMembership || null,
        full_name: full
      });
    } catch {}
    s.stage = "guest";
    s.awaiting = undefined;
    s.tmpMembership = undefined;
    return ctx.reply("Teşekkürler. Talebiniz alındı.", guestMenu);
  }
});

// Navigasyon
bot.hears("Ana Menü", async (ctx)=>{
  const s = S(ctx.from.id);
  if (s.stage === "member") return ctx.reply("Ana menü:", memberMenu);
  if (s.stage === "guest") return ctx.reply("Ana menü:", guestMenu);
  return ctx.reply("Önce kanala katılın ve rol seçin.");
});
bot.hears("Geri", async (ctx)=>{
  const s = S(ctx.from.id);
  if (s.stage === "member") return ctx.reply("Menü:", memberMenu);
  if (s.stage === "guest") return ctx.reply("Menü:", guestMenu);
  return ctx.reply("Önce kanala katılın ve rol seçin.");
});

// Misafir aksiyonları
bot.hears("RadissonBet üyesi olmak istiyorum", async (ctx)=>{
  const kb = SIGNUP_URL ? Markup.inlineKeyboard([Markup.button.url("Kayıt Ol", SIGNUP_URL)]) : undefined;
  await sendMessageByKey(ctx,"guest_become_member", kb ? { reply_markup: kb.reply_markup } : undefined);
});
bot.hears("RadissonBet ayrıcalıkları", async (ctx)=>{
  const kb = SOCIAL_URL ? Markup.inlineKeyboard([Markup.button.url("Radisson Sosyal", SOCIAL_URL)]) : undefined;
  await sendMessageByKey(ctx,"guest_benefits", kb ? { reply_markup: kb.reply_markup } : undefined);
});
bot.hears("Etkinlikler ve fırsatlar", (ctx)=> sendMessageByKey(ctx,"events"));

// Üye aksiyonları
bot.hears("Hesap Bilgilerimi Güncelle", (ctx)=> sendMessageByKey(ctx,"member_update_account"));
bot.hears("Ücretsiz Etkinlikler ve Bonuslar", (ctx)=> sendMessageByKey(ctx,"member_free_events"));
bot.hears("Bana Özel Etkinlikler ve Fırsatlar", (ctx)=> sendMessageByKey(ctx,"member_personal_offers"));

// Çekiliş ve kampanyalar
bot.hears("Çekilişe Katıl", async (ctx)=>{
  const s = S(ctx.from.id);
  if (s.stage!=="member" && s.stage!=="guest") return ctx.reply("Önce rol seçin.");
  try{
    const { data } = await api.post("/raffle/enter",{ external_id:String(ctx.from.id), raffle_key:"default_raffle" });
    if (data.joined) return sendMessageByKey(ctx,"raffle_joined");
    if (data.reason==="already") return sendMessageByKey(ctx,"raffle_already");
    return ctx.reply("Çekiliş aktif değil.");
  }catch{ return ctx.reply("Çekiliş kaydı yapılamadı."); }
});
bot.hears("Özel Kampanyalar", async (ctx)=>{
  const s = S(ctx.from.id);
  if (s.stage!=="member" && s.stage!=="guest") return ctx.reply("Önce rol seçin.");
  try{
    const { data } = await api.get("/raffles/active");
    if (!Array.isArray(data) || !data.length) return ctx.reply("Aktif kampanya yok.");
    const rows = data.map(r => [Markup.button.callback(r.title,`raffle_join:${r.key}`)]);
    await ctx.reply("Aktif kampanyalar:", Markup.inlineKeyboard(rows));
  }catch{ return ctx.reply("Kampanyalar alınamadı."); }
});
bot.action(/raffle_join:.+/, async (ctx)=>{
  const key = ctx.callbackQuery.data.split(":")[1];
  try{
    const { data } = await api.post("/raffle/enter",{ external_id:String(ctx.from.id), raffle_key:key });
    await ctx.answerCbQuery(data.joined?"Katılım alındı":(data.reason==="already"?"Zaten katıldınız":"Pasif kampanya"));
    if (data.joined) await sendMessageByKey(ctx,"raffle_joined");
    else if (data.reason==="already") await sendMessageByKey(ctx,"raffle_already");
  }catch{ await ctx.answerCbQuery("Hata"); }
});

// Global hata mesajı
bot.catch(async (err, ctx) => {
  console.error("Bot error:", err);
  try { await ctx.reply("⚠️ İşlem sırasında hata oluştu. Lütfen tekrar deneyin."); } catch {}
});

bot.launch({ dropPendingUpdates: true });
console.log("Bot http + notify hazır.");
