const trimQ = (s)=> (s ?? "").toString().trim().replace(/^['"]+|['"]+$/g,"");
const isUrl = (u)=> { try { new URL(u); return true; } catch { return false; } };

export function buildFixedButtons() {
  const GUNCEL = trimQ(process.env.GUNCEL_GIRIS_URL || process.env.NEXT_PUBLIC_GUNCEL_GIRIS_URL);
  const SOCIAL = trimQ(process.env.SOCIAL_URL || process.env.NEXT_PUBLIC_SOCIAL_URL);
  const MEMBER = trimQ(process.env.BOT_MEMBER_DEEPLINK || process.env.NEXT_PUBLIC_BOT_MEMBER_DEEPLINK);
  const arr = [
    { text: "Radissonbet Güncel Giriş", url: GUNCEL },
    { text: "Ücretsiz Etkinlik",        url: SOCIAL },
    { text: "Bonus",                     url: SOCIAL },
    { text: "Promosyon Kodları",         url: SOCIAL },
    { text: "Bana Özel Fırsatlar",       url: MEMBER },
  ].filter(b => b.url && isUrl(b.url));
  return JSON.stringify(arr); // DB'ye $x::jsonb ile yazacağız
}
