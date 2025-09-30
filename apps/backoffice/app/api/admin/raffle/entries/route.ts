import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") || "default_raffle";

  const r = await fetch(
    `${process.env.API_BASE}/admin/raffle/entries?key=${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` }, cache: "no-store" }
  ).catch(() => null);

  if (!r) return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  const d = await r.json().catch(() => ({ error: "bad_json" }));
  return NextResponse.json(d, { status: r.ok ? 200 : r.status });
}
