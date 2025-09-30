import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import http from "http";
import https from "https";

const { BOT_TOKEN, CHANNEL_USERNAME, APP_URL, CACHE_TTL_MS, BOT_WRITE_SECRET, SOCIAL_URL, SIGNUP_URL } = process.env;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!CHANNEL_USERNAME) throw new Error("CHANNEL_USERNAME is required");
if (!APP_URL) throw new Error("APP_URL is required");

const TTL = Number(CACHE_TTL_MS || 60000);

const api = axios.create({
  baseURL: APP_URL,
  timeout: 3000,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

const bot = new Telegraf(BOT_TOKEN);

// Sabit menüler + navigasyon
const backRow = ["Geri", "Ana Menü"];
const roleMenu = Markup.keyboard([["RadissonBet Üyesiyim"], ["Misafirim"], backRow]).resize();
const memberMenu = Markup.keyboard(
  [["Hesap Bilgilerimi Güncelle"], ["Ücretsiz Etkinlikler ve Bonuslar"], ["Bana Özel Etkinlikler ve Fırsatlar"], backRow]
).resize();
const guestMenu = Markup.keyboard(
  [["RadissonBet üyesi olmak istiyorum"], ["RadissonBet ayrıcalıkları"], ["Etkinlikler ve fırsatlar"], backRow]
).resize();

const state = new Map();
const cache = new Map();
const getCached=(k)=>{const it=cache.get(k);return it&&it.exp>Date.now()?it.value:null;};
const setCached=(k,v,ttl=TTL)=>cache.set(k,{value:v,exp:Date.now()+ttl});
async function fetchMessage(key){ const {data}=await api.get(`/messages/${key}`); setCached(key,data); return data; }
async function getMessage(key){ const c=getCached(key); if(c){ fetchMessage(key).catch(()=>{}); return c; } try{ return await fetchMessage(key);}catch{ return {content:"İçerik bulunamadı."}; } }

async function sendMessageByKey(ctx, key, extraKb){
  const msg = await getMessage(key);
  const textPromise = ctx.reply(msg.content, extraKb).catch(()=>{});
  if (msg.file_id) {
    setImmediate(async()=>{ try{ await ctx.replyWithPhoto(msg.file_id, { caption: msg.content }); }catch{}});
  } else if (msg.image_url) {
    setImmediate(async()=>{
      try{
        const resp = await axios.get(msg.image_url,{responseType:"arraybuffer",timeout:4000,maxRedirects:4});
        const sent = await ctx.replyWithPhoto({source:Buffer.from(resp.data),filename:"image"}, { caption: msg.content });
        if (sent?.photo?.length && BOT_WRITE_SECRET) {
          const fid = sent.photo[sent.photo.length - 1].file_id;
          await api.put(`/bot/messages/${key}/file-id`, { file_id: fid }, { headers: { "x-bot-secret": BOT_WRITE_SECRET } });
          setCached(key,{...msg,file_id:fid});
        }
      }catch{}
    });
  }
  return textPromise;
}

const joinKeyboard = Markup.inlineKeyboard([
  Markup.button.url("Kanala Katıl", `https://t.me/${CHANNEL_USERNAME.replace("@","")}`),
  Markup.button.callback("Kontrol et", "verify_join")
]);

async function isChannelMember(ctx){
  try{
    const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
    return ["creator","administrator","member"].includes(member.status);
  }catch{ return false; }
}
const getUserState=(uid)=>{ if(!state.has(uid)) state.set(uid,{}); return state.get(uid); };

async function welcomeAndGuide(ctx){
  await sendMessageByKey(ctx,"welcome");
  const ok = await isChannelMember(ctx);
  if(!ok){ await sendMessageByKey(ctx,"not_member",{ reply_markup: joinKeyboard.reply_markup }); return false; }
  return true;
}

// Start
bot.start(async (ctx)=>{
  const ok = await welcomeAndGuide(ctx);
  if(!ok) return;
  const s=getUserState(ctx.from.id);
  if (s.membershipId) await ctx.reply("Üyelik menüsü:", memberMenu);
  else await ctx.reply("Lütfen bir seçenek seçin:", roleMenu);
});

// Selam
bot.hears(["Merhaba","merhaba","Start","start"], async (ctx)=>{
  const ok = await welcomeAndGuide(ctx);
  if(!ok) return;
  const s=getUserState(ctx.from.id);
  await ctx.reply("Menü:", s.membershipId?memberMenu:guestMenu);
});

// Kanal kontrol butonu
bot.action("verify_join", async (ctx)=>{
  const ok = await isChannelMember(ctx);
  await ctx.answerCbQuery(ok?"Üyelik doğrulandı":"Hâlâ üye görünmüyor");
  if(!ok) return;
  await ctx.editMessageText("Teşekkürler. Devam edebilirsiniz.");
  const s=getUserState(ctx.from.id);
  if (s.membershipId) await ctx.reply("Üyelik menüsü:", memberMenu);
  else await ctx.reply("Lütfen bir seçenek seçin:", roleMenu);
});

// Navigasyon
bot.hears("Ana Menü", async (ctx)=> ctx.reply("Ana menü:", roleMenu));
bot.hears("Geri", async (ctx)=>{
  const s=getUserState(ctx.from.id);
  return ctx.reply("Menü:", s.membershipId?memberMenu:guestMenu);
});

/* Üyelik akışı */
bot.hears("RadissonBet Üyesiyim", async (ctx)=>{
  if(!await isChannelMember(ctx)) return sendMessageByKey(ctx,"not_member",{ reply_markup: joinKeyboard.reply_markup });
  const s=getUserState(ctx.from.id);
  s.awaiting="membership";
  await ctx.reply("Üyelik ID’nizi girin (sadece rakam):");
});

bot.on("text", async (ctx)=>{
  const s=getUserState(ctx.from.id);
  const text=(ctx.message.text||"").trim();

  if (s.awaiting==="membership") {
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
        s.membershipId=text; s.awaiting=null;
        return ctx.reply(`Merhaba ${data.first_name} ${data.last_name}. Üyelik menüsü:`, memberMenu);
      } else {
        s.awaiting="fullname"; s.tmpMembership=text;
        return ctx.reply("ID bulunamadı. Lütfen Ad Soyad yazın (ör: \"Adınız Soyadınız\").");
      }
    }catch{ return ctx.reply("Şu an doğrulama yapılamıyor. Tekrar deneyin."); }
  }

  if (s.awaiting==="fullname") {
    const full=text.replace(/\s+/g," ").trim();
    if (!full.includes(" ")) return ctx.reply("Lütfen ad ve soyadı birlikte yazın.");
    try{
      await api.post(`/pending-requests`, {
        external_id:String(ctx.from.id),
        provided_membership_id:s.tmpMembership||null,
        full_name: full
      });
    }catch{}
    s.awaiting=null; s.tmpMembership=null;
    return ctx.reply("Teşekkürler. Talebiniz oluşturuldu. Ekibimiz kontrol edip dönüş yapacak.", memberMenu);
  }
});

/* Misafir akışı + yönlendirmeler */
bot.hears("Misafirim", async (ctx)=>{
  if(!await isChannelMember(ctx)) return sendMessageByKey(ctx,"not_member",{ reply_markup: joinKeyboard.reply_markup });
  await ctx.reply("Misafir menüsü:", guestMenu);
});
bot.hears("RadissonBet üyesi olmak istiyorum", async (ctx)=>{
  const kb = Markup.inlineKeyboard([
    ...(SIGNUP_URL ? [Markup.button.url("Kayıt Ol", SIGNUP_URL)] : [])
  ]);
  await sendMessageByKey(ctx,"guest_become_member", SIGNUP_URL ? { reply_markup: kb.reply_markup } : undefined);
});
bot.hears("RadissonBet ayrıcalıkları", async (ctx)=>{
  const kb = Markup.inlineKeyboard([
    ...(SOCIAL_URL ? [Markup.button.url("Radisson Sosyal", SOCIAL_URL)] : [])
  ]);
  await sendMessageByKey(ctx,"guest_benefits", SOCIAL_URL ? { reply_markup: kb.reply_markup } : undefined);
});
bot.hears("Etkinlikler ve fırsatlar", (ctx)=>sendMessageByKey(ctx,"events"));

bot.hears("Hesap Bilgilerimi Güncelle", (ctx)=>sendMessageByKey(ctx,"member_update_account"));
bot.hears("Ücretsiz Etkinlikler ve Bonuslar", (ctx)=>sendMessageByKey(ctx,"member_free_events"));
bot.hears("Bana Özel Etkinlikler ve Fırsatlar", (ctx)=>sendMessageByKey(ctx,"member_personal_offers"));

bot.launch({ dropPendingUpdates: true });
console.log("Bot: sıra ve doğrulama akışı güncellendi.");
