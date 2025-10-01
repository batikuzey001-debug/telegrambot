import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy: Güncelle
 * PUT /admin/messages/:key
 */
export async function PUT(req: NextRequest, ctx: { params: { key: string } }) {
  const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN;

  if (!API_URL || !ADMIN_TOKEN) {
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  const body = await req.text();
  const r = await fetch(`${API_URL}/admin/messages/${encodeURIComponent(ctx.params.key)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ADMIN_TOKEN}`,
    },
    body,
  });

  const out = await r.text();
  return new NextResponse(out, {
    status: r.status,
    headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
  });
}
