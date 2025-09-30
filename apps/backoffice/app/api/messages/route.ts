import { NextResponse } from "next/server";

// Tüm mesajları listele
export async function GET() {
  try {
    const r = await fetch(`${process.env.API_BASE}/admin/messages`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
      cache: "no-store",
    });
    const d = await r.json().catch(() => ([]));
    return NextResponse.json(d, { status: r.ok ? 200 : r.status });
  } catch (e: any) {
    return NextResponse.json({ error: "fetch_failed", detail: String(e) }, { status: 502 });
  }
}
