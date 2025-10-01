import { NextRequest, NextResponse } from "next/server";
const trimQ = (s?: string | null) => (s ?? "").toString().trim().replace(/^['"]+|['"]+$/g, "");
const isUrl = (u: string) => { try { new URL(u); return true; } catch { return false; } };

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

const API_URL = trimQ(process.env.API_URL) || trimQ(process.env.API_BASE) || trimQ(process.env.NEXT_PUBLIC_API_URL);
const ADMIN_TOKEN = trimQ(process.env.ADMIN_TOKEN) || trimQ(process.env.NEXT_PUBLIC_ADMIN_TOKEN);

export async function PUT(req: NextRequest, ctx: { params: { key: string } }) {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  try {
    const src = await req.json();
    const payload: any = {
      title: String(src.title || "").trim(),
      content: String(src.content || ""),
      image_url: (() => { const u = trimQ(src.image_url); return u && isUrl(u) ? u : null; })(),
      buttons: buildButtons(),
    };
    if (typeof src.active === "boolean") payload.active = !!src.active;

    const r = await fetch(`${API_URL}/admin/notifications/templates/${encodeURIComponent(ctx.params.key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify(payload),
    });
    const out = await r.text();
    return new NextResponse(out, { status: r.status, headers: { "Content-Type": r.headers.get("content-type") || "application/json" } });
  } catch {
    return NextResponse.json({ error: "proxy_failed" }, { status: 502 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: { key: string } }) {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  try {
    const r = await fetch(`${API_URL}/admin/notifications/templates/${encodeURIComponent(ctx.params.key)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    return new NextResponse(null, { status: r.status });
  } catch {
    return NextResponse.json({ error: "proxy_failed" }, { status: 502 });
  }
}
