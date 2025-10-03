import { NextResponse } from "next/server";

const val = (s?: string | null) => (s ?? "").toString().trim();
const API_URL = val(process.env.API_URL) || val(process.env.API_BASE) || val(process.env.NEXT_PUBLIC_API_URL);
const ADMIN_TOKEN = val(process.env.ADMIN_TOKEN) || val(process.env.NEXT_PUBLIC_ADMIN_TOKEN);

// GET /api/admin/messages  ->  GET {API_URL}/admin/messages
export async function GET() {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
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
