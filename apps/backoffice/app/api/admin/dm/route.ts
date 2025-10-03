import { NextRequest, NextResponse } from "next/server";

const val = (s?: string | null) => (s ?? "").toString().trim();
const API_URL = val(process.env.API_URL) || val(process.env.API_BASE) || val(process.env.NEXT_PUBLIC_API_URL);
const ADMIN_TOKEN = val(process.env.ADMIN_TOKEN) || val(process.env.NEXT_PUBLIC_ADMIN_TOKEN);

export async function POST(req: NextRequest) {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  const src = await req.json();
  const body: any = {
    external_id: val(src.external_id),
    text: val(src.text),
    image_url: val(src.image_url) || null,
    buttons: Array.isArray(src.buttons) ? src.buttons : []
  };
  if (!body.external_id || !body.text) return NextResponse.json({ error: "required" }, { status: 400 });

  const r = await fetch(`${API_URL}/admin/dm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const txt = await r.text();
  return new NextResponse(txt, {
    status: r.status,
    headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
  });
}
