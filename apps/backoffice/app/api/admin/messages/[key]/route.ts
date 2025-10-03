import { NextRequest, NextResponse } from "next/server";

const val = (s?: string | null) => (s ?? "").toString().trim();
const API_URL = val(process.env.API_URL) || val(process.env.API_BASE) || val(process.env.NEXT_PUBLIC_API_URL);
const ADMIN_TOKEN = val(process.env.ADMIN_TOKEN) || val(process.env.NEXT_PUBLIC_ADMIN_TOKEN);

// PUT /api/admin/messages/:key -> PUT {API_URL}/admin/messages/:key
export async function PUT(req: NextRequest, ctx: { params: { key: string } }) {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  const body = await req.text();
  const r = await fetch(`${API_URL}/admin/messages/${encodeURIComponent(ctx.params.key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_TOKEN}` },
    body,
  });
  const txt = await r.text();
  return new NextResponse(txt, {
    status: r.status,
    headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
  });
}
