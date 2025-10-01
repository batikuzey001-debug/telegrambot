// services/bot/index.js
import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import http from "http";
import https from "https";
import express from "express";

const {
  BOT_TOKEN, CHANNEL_USERNAME, APP_URL,
  CACHE_TTL_MS, BOT_WRITE_SECRET,
  SOCIAL_URL, SIGNUP_URL, ADMIN_NOTIFY_SECRET,
  CACHE_SECRET, PORT
} = process.env;

if (!BOT_TOKEN || !CHANNEL_USERNAME || !APP_URL) throw new Error("missing env");

const TTL = Number(CACHE_TTL_MS || 60000);

/* ---------------- HTTP client (API) ---------------- */
const api = axios.create({
  baseURL: APP_URL,
  timeout: 3000,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true })
});

/* ---------------- Bot ---------------- */
const bot = new Telegraf(BOT_TOKEN);

/* ---------------- In-process cache (messages) ---------------- */
const cache = new Map(); // key -> { value, exp }
const getCached = (k) => {
  const it = cache.get(k);
  return it && it.exp > Date.now() ? it.value : null;
};
const setCached = (k, v, ttl = TTL) => cache.set(k, { value: v, exp: Date.now() + ttl });

/* ---------------- Helpers ---------------- */
async function fetchMessage(key) {
  const { data } = await api.get(`/messages/${key}`);
  setCached(key, data);
  return data;
}
async function getMessage(key) {
  const c = getCached(key);
  if (c) { fetchMessage(key).catch(() => {}); return c; }
  try { return await fetchMessage(key); }
  catch { return { content: "İçerik bulunamadı.", image_url: null, file_id: null }; }
}

async function getStatus(externalId) {
  try { const { data } = await api.get(`/users/status/${externalId}`); return data; }
  catch { return { stage: "guest" }; }
}

function buildName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
}
function personalize(st, text) {
  if (st?.stage !== "member") return text;
  const name = buildName(st.user || {});
  if (!name) return text;
  return `Sayın ${name},\n\n${text}`;
}

/** Tek mesaj kuralı: görsel varsa foto+caption; yoksa metin.
 *  Üye için caption/metin kişiselleştirilir.
 */
async function sendMessageByKey(ctx, key, extra, stOpt) {
  const st = stOpt || await getStatus(String(ctx.from.id));
  const msg = await getMessage(key);
  const content = personalize(st, msg.content);

  if (msg.file_id) {
    return ctx.replyWithPhoto(msg.file_id, { caption: content, ...extra });
  }

  if (msg.image_url) {
    try {
      const r = await axios.get(msg.image_url, { responseType: "arraybuffer", timeout: 4000, maxRedirects: 4 });
      const sent = await ctx.replyWithPhoto(
        { source: Buffer.from(r.data), filename: "image" },
        { caption: content, ...extra }
      );
      // Neden: Bir sonraki gönderimde tekrar upload edilmesin
      if (sent?.photo?.length && BOT_WRITE_SECRET) {
        const fid = sent.photo[sent.photo.length - 1].file_id;
        await api.put(`/bot/messages/${key}/file-id`, { file_id: fid }, { headers: { "x-bot-secret": BOT_WRITE_SECRET } });
        setCached(key, { ...msg, file_id: fid });
      }
      return sent;
    } catch {
      return ctx.reply(content, extra);
    }
  }

  return ctx.reply(content, extra);
}

async function isChannelMember(ctx) {
  try {
    const m = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
    return ["creator", "administrator", "member"].includes(m.status);
  } catch { return false; }
}

/* ---------------- Inline keyboards ---------------- */
const KB = {
  ROOT: Markup.inlineKeyboard([
    [Markup.button.callback("👤 RadissonBet Üyesiyim", "role_member")],
    [Markup.button.callback("🙋‍♂️ Misafirim", "role_guest")]
  ]),
  MEMBER_HOME: Markup.inlineKeyboard([
    [Markup.button.callback("🧾 Hesap Bilgilerim", "m_account")],
    [Markup.button.callback("🎁 Ücretsiz Etkinlikler", "m_free")],
    [Markup.button.callback("⭐ Bana Özel Fırsatlar", "m_offers")],
    [Markup.button.callback("📢 Özel Kampanyalar", "m_campaigns")],
    [Markup.button.callback("🎟️ Çekilişler", "m_raffle")],
    [Markup.button.callback("🏠 Ana Menü", "go_root")]
  ]),
  GUEST_HOME: Markup.inlineKeyboard([
    [Markup.button.callback("📝 Üye Ol", "g_signup")],
    [Markup.button.callback("🏅 Radisson Ayrıcalıkları", "g_benefits")],
    [Markup.button.callback("📅 Etkinlikler ve Fırsatlar", "g_events")],
    [Markup.button.callback("📢 Özel Kampanyalar", "g_campaigns")],
    [Markup.button.callback("🏠 Ana Menü", "go_root")]
  ]),
  PENDING_HOME: Markup.inlineKeyboard([
    [Markup.button.callback("🔄 Durumu Yenile", "p_refresh")],
    [Markup.button.callback("🏠 Ana Menü", "go_root")]
  ]),
  JOIN: Markup.inlineKeyboard([
    Markup.button.url("🔗 Kanala Katıl", `https://t.me/${CHANNEL_USERNAME.replace("@", "")}`),
    Markup.button.callback("✅ Kontrol Et", "verify_join")
  ])
};

/* ---------------- Light state + debouncer ---------------- */
const state = new Map(); // uid -> { stage, awaiting?, newUser? }
const S = (uid) => { if (!state.has(uid)) state.set(uid, { stage: "ROOT" }); return state.get(uid); };
const lastStart = new Map(); // uid -> ts

/* ---------------- Render helpers ---------------- */
const showRoot = (ctx) => ctx.reply("👇 Lütfen bir seçenek seçin:", KB.ROOT);
const showMember = (ctx, name) =>
  ctx.reply(name ? `👋 Merhaba ${name}\n🧭 Üyelik menüsü:` : "🧭 Üyelik menüsü:", KB.MEMBER_HOME);
const showGuest = (ctx) => ctx.reply("🧭 Misafir menüsü:", KB.GUEST_HOME);
const showPending = (ctx) => ctx.reply("⏳ Başvurunuz inceleniyor. Onaylanınca üyelik ana sayfanız açılacak.", KB.PENDING_HOME);

/* ---------------- Unified home router ---------------- */
async function routeHome(ctx) {
  const st = await getStatus(String(ctx.from.id));
  if (st.stage === "member") {
    const name = buildName(st.user || {});
    S(ctx.from.id).stage = "MEMBER";
    return showMember(ctx, name);
  }
  if (st.stage === "pending") { S(ctx.from.id).stage = "PENDING"; return showPending(ctx); }
  S(ctx.from.id).stage = "ROOT"; return showRoot(ctx);
}

/* ---------------- Start (debounced) ---------------- */
bot.start(async (ctx) => {
  const now = Date.now();
  const prev = lastStart.get(ctx.from.id) || 0;
  if (now - prev < 1500) return; // debounce duplicate /start
  lastStart.set(ctx.from.id, now);

  const st = await getStatus(String(ctx.from.id));
  await sendMessageByKey(ctx, "welcome", undefined, st);

  const ok = await isChannelMember(ctx);
  if (!ok) return sendMessageByKey(ctx, "not_member", KB.JOIN, st);
  return routeHome(ctx);
});

/* ---------------- Join check ---------------- */
bot.action("verify_join", async (ctx) => {
  const ok = await isChannelMember(ctx);
  await ctx.answerCbQuery(ok ? "✅ Doğrulandı" : "⛔ Üye görünmüyor");
  if (!ok) return;
  try { await ctx.editMessageText("✅ Teşekkürler. Devam edebilirsiniz."); } catch {}
  return routeHome(ctx);
});

/* ---------------- Root and navigation ---------------- */
bot.action("go_root", (ctx) => routeHome(ctx));

/* ---------------- Registration flow (guarded) ---------------- */
bot.action("role_member", async (ctx) => {
  const st = await getStatus(String(ctx.from.id));
  if (st.stage === "member") return showMember(ctx, buildName(st.user || {}));
  if (st.stage === "pending") return showPending(ctx);

  const s = S(ctx.from.id);
  s.newUser = { username: null, id: null };
  s.awaiting = "username";
  await ctx.reply("🧾 RadissonBet kullanıcı adınız nedir?");
});

bot.on("text", async (ctx) => {
  const st = await getStatus(String(ctx.from.id));
  if (st.stage === "member") return showMember(ctx, buildName(st.user || {}));
  if (st.stage === "pending") return showPending(ctx);

  const s = S(ctx.from.id);
  const text = (ctx.message.text || "").trim();

  if (s.awaiting === "username") {
    if (!text || text.length < 2) return ctx.reply("⚠️ Geçerli bir kullanıcı adı yazın.");
    s.newUser = { ...(s.newUser || {}), username: text };
    s.awaiting = "membership";
    return ctx.reply("🔢 Üyelik numaranızı girin (sadece rakam):");
  }

  if (s.awaiting === "membership") {
    if (!/^[0-9]+$/.test(text)) return ctx.reply("⚠️ Geçersiz numara. Sadece rakam girin.");
    s.newUser = { ...(s.newUser || {}), id: text };

    const confirmText =
      "🧩 Bilgilerini Onayla\n~~~~~~~~~~~~~~~~~~~~\n" +
      `👤 Kullanıcı adı: ${s.newUser.username}\n` +
      `🪪 Üyelik numarası: ${s.newUser.id}\n~~~~~~~~~~~~~~~~~~~~\n` +
      "👉 Doğruysa “Evet”, düzeltmek için “Hayır”.\n↩️ Baştan girmek için “Başa Dön”.";
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("✅ Evet", "confirm_yes"), Markup.button.callback("❌ Hayır", "confirm_no")],
      [Markup.button.callback("🔙 Başa Dön", "confirm_restart")]
    ]);
    s.awaiting = "confirm";
    return ctx.reply(confirmText, kb);
  }
});

/* ---------------- Confirm flow ---------------- */
bot.action("confirm_restart", async (ctx) => {
  const s = S(ctx.from.id);
  s.newUser = { username: null, id: null };
  s.awaiting = "username";
  await ctx.editMessageText("🔄 Baştan alalım. Kullanıcı adınızı yazın:");
});

bot.action("confirm_no", async (ctx) => {
  const s = S(ctx.from.id);
  s.awaiting = "username";
  await ctx.editMessageText("❌ Bilgiler yanlış. Lütfen kullanıcı adınızı tekrar yazın:");
});

bot.action("confirm_yes", async (ctx) => {
  const s = S(ctx.from.id);
  if (!s?.newUser?.id || !s?.newUser?.username) { await ctx.answerCbQuery("⚠️ Eksik bilgi").catch(() => {}); return routeHome(ctx); }
  try {
    const { data } = await api.get(`/members/${s.newUser.id}`);
    if (data.found) {
      await api.post(`/users`, {
        external_id: String(ctx.from.id),
        membership_id: s.newUser.id,
        submitted_username: s.newUser.username,
        tg_first_name: ctx.from.first_name || null,
        tg_last_name: ctx.from.last_name || null,
        tg_username: ctx.from.username || null
      });
      s.awaiting = undefined; s.newUser = undefined;
      return routeHome(ctx);
    } else {
      await api.post(`/pending-requests`, {
        external_id: String(ctx.from.id),
        provided_membership_id: s.newUser.id,
        full_name: (ctx.from.first_name || "") + (ctx.from.last_name ? " " + ctx.from.last_name : "")
      }).catch(() => {});
      s.awaiting = undefined; s.newUser = undefined;
      return routeHome(ctx);
    }
  } catch {
    await ctx.answerCbQuery("⚠️ Doğrulama yapılamadı").catch(() => {});
    return routeHome(ctx);
  }
});

/* ---------------- Pending refresh ---------------- */
bot.action("p_refresh", (ctx) => routeHome(ctx));

/* ---------------- Guest panels ---------------- */
bot.action("role_guest", (ctx) => { S(ctx.from.id).stage = "GUEST"; return showGuest(ctx); });
bot.action("g_signup", async (ctx) => {
  const kb = SIGNUP_URL
    ? Markup.inlineKeyboard([[Markup.button.url("📝 Kayıt Ol", SIGNUP_URL)], [Markup.button.callback("↩️ Geri", "go_guest")]])
    : KB.GUEST_HOME;
  return ctx.reply("📝 Üye Ol açıklaması:", kb);
});
bot.action("g_benefits", async (ctx) => {
  const kb = SOCIAL_URL
    ? Markup.inlineKeyboard([[Markup.button.url("🏅 Radisson Sosyal", SOCIAL_URL)], [Markup.button.callback("↩️ Geri", "go_guest")]])
    : KB.GUEST_HOME;
  return ctx.reply("🏅 Ayrıcalıklar:", kb);
});
bot.action("g_events", (ctx) => sendMessageByKey(ctx, "events", KB.GUEST_HOME));
bot.action("g_campaigns", (ctx) => ctx.reply("📢 Kampanyalar (katılmak için üye olunmalı).", KB.GUEST_HOME));
bot.action("go_guest", (ctx) => showGuest(ctx));

/* ---------------- Member-only panels ---------------- */
async function requireMember(ctx) {
  const st = await getStatus(String(ctx.from.id));
  if (st.stage !== "member") { await ctx.answerCbQuery("⛔ Üyelik gerekli", { show_alert: true }).catch(() => {}); return false; }
  return true;
}
bot.action("m_account", async (ctx) => { if (!(await requireMember(ctx))) return; await ctx.reply("🧾 Hesap bilgileri yakında.", KB.MEMBER_HOME); });

/* Ücretsiz Etkinlikler → Radisson Sosyal'e yönlendirme butonu */
bot.action("m_free", async (ctx) => {
  if (!(await requireMember(ctx))) return;
  const kb = SOCIAL_URL
    ? Markup.inlineKeyboard([[Markup.button.url("🔗 Radisson Sosyal", SOCIAL_URL)], [Markup.button.callback("↩️ Geri", "go_member")]])
    : KB.MEMBER_HOME;
  return sendMessageByKey(ctx, "member_free_events", kb);
});

/* Bana Özel Fırsatlar → yapım aşaması metni */
bot.action("m_offers", async (ctx) => {
  if (!(await requireMember(ctx))) return;
  return sendMessageByKey(ctx, "member_personal_offers", KB.MEMBER_HOME);
});

/* Özel Kampanyalar → Radisson Sosyal'e yönlendirme butonu + mevcut kampanya listesi */
bot.action("m_campaigns", async (ctx) => {
  if (!(await requireMember(ctx))) return;
  if (SOCIAL_URL) {
    await ctx.reply("📢 Özel kampanyalar için Radisson Sosyal:", Markup.inlineKeyboard([
      [Markup.button.url("🔗 Radisson Sosyal", SOCIAL_URL)],
      [Markup.button.callback("↩️ Geri", "go_member")]
    ]));
  }
  try {
    const { data } = await api.get("/raffles/active");
    if (!Array.isArray(data) || !data.length) return ctx.reply("ℹ️ Aktif kampanya yok.", KB.MEMBER_HOME);
    const rows = data.map((r) => [Markup.button.callback(`📣 ${r.title}`, `raffle_join:${r.key}`)]);
    return ctx.reply("📢 Aktif kampanyalar:", Markup.inlineKeyboard([...rows, [Markup.button.callback("↩️ Geri", "go_member")]]));
  } catch { return ctx.reply("⚠️ Kampanyalar alınamadı.", KB.MEMBER_HOME); }
});

bot.action("go_member", (ctx) => showMember(ctx));
bot.action("m_raffle", async (ctx) => {
  if (!(await requireMember(ctx))) return;
  try {
    const { data } = await api.post("/raffle/enter", { external_id: String(ctx.from.id), raffle_key: "default_raffle" });
    if (data.joined) return sendMessageByKey(ctx, "raffle_joined", KB.MEMBER_HOME);
    if (data.reason === "already") return sendMessageByKey(ctx, "raffle_already", KB.MEMBER_HOME);
    return ctx.reply("⚠️ Çekiliş aktif değil.", KB.MEMBER_HOME);
  } catch { return ctx.reply("⚠️ Çekiliş kaydı yapılamadı.", KB.MEMBER_HOME); }
});
bot.action(/raffle_join:.+/, async (ctx) => {
  if (!(await requireMember(ctx))) return;
  const key = ctx.callbackQuery.data.split(":")[1];
  try {
    const { data } = await api.post("/raffle/enter", { external_id: String(ctx.from.id), raffle_key: key });
    await ctx.answerCbQuery(data.joined ? "🎟️ Katılım alındı" : (data.reason === "already" ? "🔁 Zaten katıldınız" : "⛔ Pasif kampanya")).catch(() => {});
    if (data.joined) await sendMessageByKey(ctx, "raffle_joined", KB.MEMBER_HOME);
    else if (data.reason === "already") await sendMessageByKey(ctx, "raffle_already", KB.MEMBER_HOME);
  } catch { await ctx.answerCbQuery("⚠️ Hata").catch(() => {}); }
});

/* ---------------- Unknown callback -> home ---------------- */
bot.on("callback_query", async (ctx, next) => {
  const d = ctx.callbackQuery?.data || "";
  const known = /^(role_|g_|m_|go_|p_refresh|confirm_|raffle_join:)/.test(d);
  if (!known) { await ctx.answerCbQuery("⚠️ Geçersiz seçim").catch(() => {}); return routeHome(ctx); }
  return next();
});

/* ---------------- Global error ---------------- */
bot.catch(async (err, ctx) => {
  console.error("Bot error:", err);
  try { await ctx.reply("⚠️ Hata oluştu. Menüye dönüyorum."); await routeHome(ctx); } catch {}
});

/* ---------------- Minimal HTTP (invalidate + notify) ---------------- */
const httpApp = express();
httpApp.use(express.json());
httpApp.get("/", (_req, res) => res.json({ ok: true, service: "bot" }));
httpApp.post("/admin/notify", async (req, res) => {
  if ((req.headers["x-admin-secret"] || "") !== (ADMIN_NOTIFY_SECRET || "")) return res.status(401).json({ error: "unauthorized" });
  const { external_id, text } = req.body || {};
  if (!external_id || !text) return res.status(400).json({ error: "required" });
  try { await bot.telegram.sendMessage(String(external_id), text, { parse_mode: "HTML" }); return res.json({ ok: true }); }
  catch { return res.status(500).json({ error: "send_failed" }); }
});
httpApp.post("/invalidate", (req, res) => {
  if ((req.headers["x-cache-secret"] || "") !== (CACHE_SECRET || "")) return res.status(401).json({ error: "unauthorized" });
  const { key } = req.body || {};
  if (key) cache.delete(key); else cache.clear();
  return res.json({ ok: true });
});
httpApp.listen(Number(PORT || 3001), () => console.log(`bot http on :${Number(PORT || 3001)}`));

/* ---------------- Launch (single instance, conflict-safe) ---------------- */
async function bootstrap() {
  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {}); // 409 önleme
    await bot.launch({ dropPendingUpdates: true });
    console.log("Bot: kişiselleştirilmiş iletiler aktif; tek mesaj/tek görsel; invalidate hazır.");
  } catch (e) {
    console.error("Launch error:", e);
    process.exit(1);
  }
}
bootstrap();

// graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
