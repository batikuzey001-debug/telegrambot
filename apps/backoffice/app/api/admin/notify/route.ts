import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const url = process.env.BOT_ADMIN_NOTIFY_URL!;
  const secret = process.env.BOT_ADMIN_NOTIFY_SECRET!;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json", "x-admin-secret": secret },
    body: JSON.stringify(body)
  }).catch(() => null);
  if (!r) return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  const d = await r.json().catch(() => ({}));
  return NextResponse.json(d, { status: r.ok ? 200 : r.status });
}
