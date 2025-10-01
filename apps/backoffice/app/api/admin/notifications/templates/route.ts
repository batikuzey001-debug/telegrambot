import { NextRequest, NextResponse } from "next/server";

/* helpers */
const trimQ = (s?: string | null) => (s ?? "").toString().trim().replace(/^['"]+|['"]+$/g, "");
const isUrl = (u: string) => { try { new URL(u); return true; } catch { return false; } };

/* fixed buttons */
function buildButtons() {
  const GUNCEL = trimQ(process.env.GUNCEL_GIRIS_URL || process.env.NEXT_PUBLIC_GUNCEL_GIRIS_URL);
  const SOCIAL = trimQ(process.env.SOCIAL_URL || process.env.NEXT_PUBLIC_SOCIAL_URL);
  const MEMBER = trimQ(process.env.BOT_MEMBER_DEEPLINK || process.env.NEXT_PUBLIC_BOT_MEMBER_DEEPLINK);
  return [
    { text: "Radissonbet Güncel Giriş", url: GUNCEL },
    { text: "Ücretsiz Etkinlik", url: SOCIAL },
    { text: "Bonus", url: SOCIAL },
    { text: "Promosyon Kodları", url: SOCIAL },
    { text: "Bana Özel Fırsatlar", url: MEMBER },
  ].filter(b => b.url && isUrl(b.url));
}

/* env */
const API_URL = trimQ(process.env.API_URL) || trimQ(process.env.API_BASE) || trimQ(process.env.NEXT_PUBLIC_API_URL);
const ADMIN_TOKEN = trimQ(process.env.ADMIN_TOKEN) || trimQ(process.env.NEXT_PUBLIC_ADMIN_TOKEN);

export async function GET() {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  try {
    const r = await fetch(`${API_URL}/admin/notifications/templates`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      cache: "no-store",
    });
    const body = await r.text();
    return new NextResponse(body, { status: r.status, headers: { "Content-Type": r.headers.get("content-type") || "application/json" } });
  } catch (e) {
    return NextResponse.json({ error: "proxy_failed" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  try {
    const src = await req.json();
    const payload = {
      key: String(src.key || "").trim(),
      title: String(src.title || "").trim(),
      content: String(src.content || ""),
      image_url: (() => { const u = trimQ(src.image_url); return u && isUrl(u) ? u : null; })(),
      buttons: buildButtons(),
      active: !!src.active,
    };
    if (!payload.key || !payload.title || !payload.content) {
      return NextResponse.json({ error: "required" }, { status: 400 });
    }
    const r = await fetch(`${API_URL}/admin/notifications/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify(payload),
    });
    const out = await r.text();
    return new NextResponse(out, { status: r.status, headers: { "Content-Type": r.headers.get("content-type") || "application/json" } });
  } catch {
    return NextResponse.json({ error: "proxy_failed" }, { status: 502 });
  }
}
