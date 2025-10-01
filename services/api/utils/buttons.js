const trim = (s)=> (s ?? "").toString().trim().replace(/^['"]+|['"]+$/g,"");
const ok = (u)=>{ try{ new URL(u); return true; }catch{ return false; } };

export function buildFixedButtons() {
  const GUNCEL = trim(process.env.GUNCEL_GIRIS_URL || process.env.NEXT_PUBLIC_GUNCEL_GIRIS_URL);
  const SOCIAL = trim(process.env.SOCIAL_URL || process.env.NEXT_PUBLIC_SOCIAL_URL);
  const MEMBER = trim(process.env.BOT_MEMBER_DEEPLINK || process.env.NEXT_PUBLIC_BOT_MEMBER_DEEPLINK);
  const arr = [
    { text: "Radissonbet Güncel Giriş", url: GUNCEL },
    { text: "Ücretsiz Etkinlik",        url: SOCIAL },
    { text: "Bonus",                     url: SOCIAL },
    { text: "Promosyon Kodları",         url: SOCIAL },
    { text: "Bana Özel Fırsatlar",       url: MEMBER },
  ].filter(b => b.url && ok(b.url));
  return JSON.stringify(arr); // jsonb cast için string
}
