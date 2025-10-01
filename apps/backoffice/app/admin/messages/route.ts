import { NextResponse } from "next/server";

/**
 * Server-side proxy: Liste
 * Güvenlik: ADMIN_TOKEN sadece server env’de okunur.
 */
export async function GET() {
  const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN;

  if (!API_URL || !ADMIN_TOKEN) {
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  const r = await fetch(`${API_URL}/admin/messages`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    cache: "no-store",
  });

  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
  });
}
