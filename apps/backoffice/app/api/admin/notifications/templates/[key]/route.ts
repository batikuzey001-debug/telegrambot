import { NextRequest, NextResponse } from "next/server";

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

export async function PUT(req: NextRequest, ctx: { params: { key: string } }) {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  const src = await req.json();
  const payload = {
    title: String(src.title || "").trim(),
    content: String(src.content || ""),
    image_url: src.image_url || null,
    buttons: buildButtons(),  // sabit
    active: typeof src.active === "boolean" ? src.active : undefined,
  };
  const r = await fetch(`${API_URL}/admin/notifications/templates/${encodeURIComponent(ctx.params.key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify(payload),
  });
  const out = await r.text();
  return new NextResponse(out, { status: r.status, headers: { "Content-Type": "application/json" } });
}

export async function DELETE(_req: NextRequest, ctx: { params: { key: string } }) {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  const r = await fetch(`${API_URL}/admin/notifications/templates/${encodeURIComponent(ctx.params.key)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  return new NextResponse(null, { status: r.status });
}
