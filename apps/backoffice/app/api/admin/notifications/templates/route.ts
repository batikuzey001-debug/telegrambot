import { NextRequest, NextResponse } from "next/server";

/* ---------- helpers ---------- */
function sanitizeUrl(u: string | undefined | null): string {
  if (!u) return "";
  const s = String(u).trim();
  // çevreden tırnakla gelmişse temizle
  return s.replace(/^['"]+|['"]+$/g, "");
}
function isValidUrl(u: string): boolean {
  try { new URL(u); return true; } catch { return false; }
}

/* ---------- fixed buttons ---------- */
function buildButtons() {
  const GUNCEL = sanitizeUrl(process.env.GUNCEL_GIRIS_URL || process.env.NEXT_PUBLIC_GUNCEL_GIRIS_URL);
  const SOCIAL = sanitizeUrl(process.env.SOCIAL_URL || process.env.NEXT_PUBLIC_SOCIAL_URL);
  const MEMBER = sanitizeUrl(process.env.BOT_MEMBER_DEEPLINK || process.env.NEXT_PUBLIC_BOT_MEMBER_DEEPLINK);

  const raw = [
    { text: "Radissonbet Güncel Giriş", url: GUNCEL },
    { text: "Ücretsiz Etkinlik", url: SOCIAL },
    { text: "Bonus", url: SOCIAL },
    { text: "Promosyon Kodları", url: SOCIAL },
    { text: "Bana Özel Fırsatlar", url: MEMBER },
  ];

  // sadece geçerli URL olanlar kalsın
  return raw.filter(b => b.url && isValidUrl(b.url));
}

/* ---------- env ---------- */
const API_URL =
  sanitizeUrl(process.env.API_URL) ||
  sanitizeUrl(process.env.API_BASE) ||
  sanitizeUrl(process.env.NEXT_PUBLIC_API_URL);
const ADMIN_TOKEN =
  sanitizeUrl(process.env.ADMIN_TOKEN) ||
  sanitizeUrl(process.env.NEXT_PUBLIC_ADMIN_TOKEN);

/* ---------- routes ---------- */
export async function GET() {
  if (!API_URL || !ADMIN_TOKEN) {
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }
  try {
    const r = await fetch(`${API_URL}/admin/notifications/templates`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      cache: "no-store",
    });
    const body = await r.text();
    return new NextResponse(body, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "proxy_failed" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!API_URL || !ADMIN_TOKEN) {
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }
  try {
    const src = await req.json();
    const payload = {
      key: String(src.key || "").trim(),
      title: String(src.title || "").trim(),
      content: String(src.content || ""),
      image_url: sanitizeUrl(src.image_url) || null,
      buttons: buildButtons(), // sabit ve valid URL’ler
      active: !!src.active,
    };

    const r = await fetch(`${API_URL}/admin/notifications/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify(payload),
    });

    const out = await r.text();
    return new NextResponse(out, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "proxy_failed" }, { status: 502 });
  }
}
