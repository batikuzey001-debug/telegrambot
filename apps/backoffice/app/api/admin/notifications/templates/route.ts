import { NextRequest, NextResponse } from "next/server";

// Sabit butonları server tarafında üret
function buildButtons() {
  const GUNCEL = process.env.GUNCEL_GIRIS_URL || process.env.NEXT_PUBLIC_GUNCEL_GIRIS_URL || "";
  const SOCIAL = process.env.SOCIAL_URL || process.env.NEXT_PUBLIC_SOCIAL_URL || "";
  const MEMBER = process.env.BOT_MEMBER_DEEPLINK || process.env.NEXT_PUBLIC_BOT_MEMBER_DEEPLINK || "";

  const buttons = [
    { text: "Radissonbet Güncel Giriş", url: GUNCEL },
    { text: "Ücretsiz Etkinlik", url: SOCIAL },
    { text: "Bonus", url: SOCIAL },
    { text: "Promosyon Kodları", url: SOCIAL },
    { text: "Bana Özel Fırsatlar", url: MEMBER },
  ].filter(b => b.url);
  return buttons;
}

const API_URL = process.env.API_URL || process.env.API_BASE || process.env.NEXT_PUBLIC_API_URL;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN;

export async function GET() {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  const r = await fetch(`${API_URL}/admin/notifications/templates`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    cache: "no-store",
  });
  const body = await r.text();
  return new NextResponse(body, { status: r.status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: NextRequest) {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  const src = await req.json();
  const payload = {
    key: String(src.key || "").trim(),
    title: String(src.title || "").trim(),
    content: String(src.content || ""),
    image_url: src.image_url || null,
    buttons: buildButtons(),       // sabit
    active: !!src.active,
  };
  const r = await fetch(`${API_URL}/admin/notifications/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify(payload),
  });
  const out = await r.text();
  return new NextResponse(out, { status: r.status, headers: { "Content-Type": "application/json" } });
}
