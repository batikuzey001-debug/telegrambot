import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import http from "http";
import https from "https";

const { BOT_TOKEN, CHANNEL_USERNAME, APP_URL, CACHE_TTL_MS, BOT_WRITE_SECRET, SOCIAL_URL, SIGNUP_URL } = process.env;
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

// Ekran klavyeleri
const backRow = ["Geri", "Ana Menü"];
const roleChoiceKb = Markup.keyboard([["RadissonBet Üyesiyim"], ["Misafirim"]]).resize();
const memberMenu = Markup.keyboard(
  [["Hesap Bilgilerimi Güncelle"], ["Ücretsiz Etkinlikler ve Bonuslar"], ["Bana Özel Etkinlikler ve Fırsatlar"], ["Özel Kampanyalar"], ["Çekilişe Katıl"], backRow]
).resize();
const guestMenu = Markup.keyboard(
  [["RadissonBet üyesi olmak istiyorum"], ["RadissonBet ayrıcalıkları"], ["Etkinlikler ve fırsatlar"], ["Özel Kampanyalar"], ["Çekilişe Katıl"], backRow]
).resize();

const joinKeyboard = Markup.inlineKeyboard([
  Markup.button.url("Kanala Katıl", `https://t.me/${CHANNEL_USERNAME.replace("@","")}`),
  Markup.button.callback("Kontrol et", "verify_join")
]);

// Durum ve cache
const state = new Map(); // userId -> { stage: 'welcome'|'channel_ok'|'member'|'guest', awaiting?: 'membership'|'fullname', tmpMembership?: string }
const cache = new Map(); // key -> { value:{content,image_url,file_id}, exp }
const getCached = (k)=>{const it=cache.get(k);return it&&it.exp>Date.now()?it.value:null;};
const setCached = (k,v,ttl=TTL)=>cache.set(k,{value:v,exp:Date.now()+ttl});
async function fetchMessage(key){ const {data}=await api.get(`/messages/${key}`); setCached(key,data); return data; }
async function getMessage(key){ const c=getCached(key); if(c){ fetchMessage(key).catch(()=>{}); return c; } try{ return await fetchMessage(key);}catch{ return {content:"İçerik bulunamadı."}; } }

// Metin anlık, görsel arkada; ilk görselde file_id sakla
async function sendMessageByKey(ctx, key, extraKb){
  const msg = await getMessage(key);
  const textP = ctx.reply(msg.content, extraKb).catch(()=>{});
  if (msg.file_id) setImmediate(async()=>{ try{ await ctx.replyWithPhoto(msg.file_id, { caption: msg.content }); }catch{} });
  else if (msg.image_url) setImmediate(async()=>{ try{
    const r = await axios.get(msg.image_url,{responseType:"arraybuffer",timeout:4000,maxRedirects:4});
    const sent = await ctx.replyWithPhoto({source:Buffer.from(r.data),filename:"image"},{caption:msg.content});
    if (sent?.photo?.length && BOT_WRITE_SECRET) {
      const fid = sent.photo[sent.photo.length - 1].file_id;
      await api.put(`/bot/messages/${key}/file-id`, { file_id: fid }, { headers: { "x-bot-secret": BOT_WRITE_SECRET } });
      setCached(key,{...msg,file_id:fid});
    }
  }catch{} });
  return textP;
}

async function isChannelMember(ctx){
  try{
    const m = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
    return ["creator","administrator","member"].includes(m.status);
  }catch{ return false; }
}
function S(uid){ if(!state.has(uid)) state.set(uid,{ stage:"welcome" }); return state.get(uid); }

// ---- AKIŞ KURALLARI ----
// 1) /start: sadece hoş geldin → kanal kontrolü → ÜYE DEĞİLSE yönlendirme, ÜYEYSE rol seçimi
bot.start(async (ctx)=>{
  const s = S(ctx.from.id);
  await sendMessageByKey(ctx,"welcome");
  const ok = await isChannelMember(ctx);
  if (!ok) {
    s.stage = "welcome";
    await sendMessageByKey(ctx,"not_member",{ reply_markup: joinKeyboard.reply_markup });
    return;
  }
  s.stage = "channel_ok";
  await ctx.reply("Lütfen bir seçenek seçin:", roleChoiceKb);
});

// 2) “Kontrol et” butonu: sadece kanal doğrulaması → rol seçimi
bot.action("verify_join", async (ctx)=>{
  const s = S(ctx.from.id);
  const ok = await isChannelMember(ctx);
  await ctx.answerCbQuery(ok ? "Üyelik doğrulandı" : "Hâlâ üye görünmüyor");
  if (!ok) return;
  s.stage = "channel_ok";
  await ctx.editMessageText("Teşekkürler. Devam edebilirsiniz.");
  await ctx.reply("Lütfen bir seçenek seçin:", roleChoiceKb);
});

// 3) Selam tetikleri: /start ile aynı davranış. Menü YOK.
bot.hears(["Merhaba","merhaba","Start","start"], async (ctx)=>{
  const s = S(ctx.from.id);
  await sendMessageByKey(ctx,"welcome");
  const ok = await isChannelMember(ctx);
  if (!ok) {
    s.stage = "welcome";
    return sendMessageByKey(ctx,"not_member",{ reply_markup: joinKeyboard.reply_markup });
  }
  s.stage = "channel_ok";
  await ctx.reply("Lütfen bir seçenek seçin:", roleChoiceKb);
});

// 4) Rol seçimi: burada menü ilk kez çıkar
bot.hears("RadissonBet Üyesiyim", async (ctx)=>{
  const s = S(ctx.from.id);
  if (s.stage !== "channel_ok" && s.stage !== "guest" && s.stage !== "member") {
    return ctx.reply("Önce kanala katılımı tamamlayın.", Markup.removeKeyboard());
  }
  s.awaiting = "membership";
  await ctx.reply("Üyelik ID’nizi girin (sadece rakam):");
});

bot.hears("Misafirim", async (ctx)=>{
  const s = S(ctx.from.id);
  if (s.stage !== "channel_ok" && s.stage !== "guest" && s.stage !== "member") {
    return ctx.reply("Önce kanala katılımı tamamlayın.", Markup.removeKeyboard());
  }
  s.stage = "guest";
  await ctx.reply("Misafir menüsü:", guestMenu);
});

// 5) Üyelik ID akışı
bot.on("text", async (ctx)=>{
  const s = S(ctx.from.id);
  const text = (ctx.message.text || "").trim();

  if (s.awaiting === "membership") {
    if (!/^[0-9]+$/.test(text)) return ctx.reply("Geçersiz ID. Sadece rakam girin.");
    try{
      const { data } = await api.get(`/members/${text}`);
      if (data.found) {
        await api.post(`/users`, {
          external_id:String(ctx.from.id),
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
        return ctx.reply("ID bulunamadı. Lütfen Ad Soyad yazın (ör: \"Adınız Soyadınız\").");
      }
    }catch{
      return ctx.reply("Şu an doğrulama yapılamıyor. Tekrar deneyin.");
    }
  }

  if (s.awaiting === "fullname") {
    const full = text.replace(/\s+/g," ").trim();
    if (!full.includes(" ")) return ctx.reply("Lütfen ad ve soyadı birlikte yazın.");
    try{
      await api.post(`/pending-requests`, {
        external_id:String(ctx.from.id),
        provided_membership_id:s.tmpMembership || null,
        full_name: full
      });
    }catch{}
    s.stage = "guest"; // rol kesinleşmediği için menü olarak misafir göster
    s.awaiting = undefined;
    s.tmpMembership = undefined;
    return ctx.reply("Teşekkürler. Talebiniz alındı.", guestMenu);
  }
});

// 6) Navigasyon ve menü korumaları
bot.hears("Ana Menü", async (ctx)=>{
  const s = S(ctx.from.id);
  if (s.stage === "member") return ctx.reply("Ana menü:", memberMenu);
  if (s.stage === "guest") return ctx.reply("Ana menü:", guestMenu);
  return ctx.reply("Önce kanala katılın ve rol seçin.", Markup.removeKeyboard());
});
bot.hears("Geri", async (ctx)=>{
  const s = S(ctx.from.id);
  if (s.stage === "member") return ctx.reply("Menü:", memberMenu);
  if (s.stage === "guest") return ctx.reply("Menü:", guestMenu);
  return ctx.reply("Önce kanala katılın ve rol seçin.", Markup.removeKeyboard());
});

// 7) Misafir menüsü aksiyonları
bot.hears("RadissonBet üyesi olmak istiyorum", async (ctx)=>{
  const kb = SIGNUP_URL ? Markup.inlineKeyboard([Markup.button.url("Kayıt Ol", SIGNUP_URL)]) : undefined;
  await sendMessageByKey(ctx,"guest_become_member", kb ? { reply_markup: kb.reply_markup } : undefined);
});
bot.hears("RadissonBet ayrıcalıkları", async (ctx)=>{
  const kb = SOCIAL_URL ? Markup.inlineKeyboard([Markup.button.url("Radisson Sosyal", SOCIAL_URL)]) : undefined;
  await sendMessageByKey(ctx,"guest_benefits", kb ? { reply_markup: kb.reply_markup } : undefined);
});
bot.hears("Etkinlikler ve fırsatlar", (ctx)=> sendMessageByKey(ctx,"events"));

// 8) Üye menüsü aksiyonları
bot.hears("Hesap Bilgilerimi Güncelle", (ctx)=> sendMessageByKey(ctx,"member_update_account"));
bot.hears("Ücretsiz Etkinlikler ve Bonuslar", (ctx)=> sendMessageByKey(ctx,"member_free_events"));
bot.hears("Bana Özel Etkinlikler ve Fırsatlar", (ctx)=> sendMessageByKey(ctx,"member_personal_offers"));

// 9) Kampanyalar ve çekiliş (her iki rolde de erişilebilir, ama rol seçimi sonrası)
bot.hears("Çekilişe Katıl", async (ctx)=>{
  const s = S(ctx.from.id);
  if (s.stage !== "member" && s.stage !== "guest") return ctx.reply("Önce rol seçin.", Markup.removeKeyboard());
  try{
    const { data } = await api.post("/raffle/enter", { external_id:String(ctx.from.id), raffle_key:"default_raffle" });
    if (data.joined) return sendMessageByKey(ctx,"raffle_joined");
    if (data.reason==="already") return sendMessageByKey(ctx,"raffle_already");
    return ctx.reply("Çekiliş aktif değil.");
  }catch{ return ctx.reply("Çekiliş kaydı yapılamadı."); }
});

bot.hears("Özel Kampanyalar", async (ctx)=>{
  const s = S(ctx.from.id);
  if (s.stage !== "member" && s.stage !== "guest") return ctx.reply("Önce rol seçin.", Markup.removeKeyboard());
  try{
    const { data } = await api.get("/raffles/active");
    if (!Array.isArray(data) || !data.length) return ctx.reply("Aktif kampanya yok.");
    const rows = data.map(r => [Markup.button.callback(r.title, `raffle_join:${r.key}`)]);
    await ctx.reply("Aktif kampanyalar:", Markup.inlineKeyboard(rows));
  }catch{ return ctx.reply("Kampanyalar alınamadı."); }
});
bot.action(/raffle_join:.+/, async (ctx)=>{
  const key = ctx.callbackQuery.data.split(":")[1];
  try{
    const { data } = await api.post("/raffle/enter", { external_id:String(ctx.from.id), raffle_key:key });
    await ctx.answerCbQuery(data.joined ? "Katılım alındı" : (data.reason==="already" ? "Zaten katıldınız" : "Pasif kampanya"));
    if (data.joined) await sendMessageByKey(ctx,"raffle_joined");
    else if (data.reason==="already") await sendMessageByKey(ctx,"raffle_already");
  }catch{ await ctx.answerCbQuery("Hata"); }
});

bot.launch({ dropPendingUpdates: true });
console.log("Bot: sıralama sabitlendi. Menü yalnızca kanal doğrulaması + rol seçiminden sonra.");
