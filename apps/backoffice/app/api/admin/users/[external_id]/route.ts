import { NextRequest, NextResponse } from "next/server";

const trim = (s?: string | null) => (s ?? "").toString().trim();
const API_URL = trim(process.env.API_URL) || trim(process.env.API_BASE) || trim(process.env.NEXT_PUBLIC_API_URL);
const ADMIN_TOKEN = trim(process.env.ADMIN_TOKEN) || trim(process.env.NEXT_PUBLIC_ADMIN_TOKEN);

export async function DELETE(_req: NextRequest, ctx: { params: { external_id: string } }) {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  const r = await fetch(`${API_URL}/users/admin/${encodeURIComponent(ctx.params.external_id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  return new NextResponse(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}

export async function PATCH(req: NextRequest, ctx: { params: { external_id: string } }) {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  const body = await req.text();
  const r = await fetch(`${API_URL}/users/admin/${encodeURIComponent(ctx.params.external_id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_TOKEN}` },
    body,
  });
  return new NextResponse(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}
