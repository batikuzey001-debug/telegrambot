import { NextResponse } from "next/server";

export async function GET() {
  const r = await fetch(`${process.env.API_BASE}/admin/raffle/entries?key=default_raffle`, {
    headers: { "Authorization": `Bearer ${process.env.ADMIN_TOKEN}` },
    cache: "no-store"
  });
  const d = await r.json();
  return NextResponse.json(d, { status: r.ok ? 200 : r.status });
}
