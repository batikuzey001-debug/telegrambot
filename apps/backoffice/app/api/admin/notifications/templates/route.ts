import { NextResponse } from "next/server";

export async function GET() {
  const r = await fetch(`${process.env.API_BASE}/admin/notifications/templates`, {
    headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    cache: "no-store"
  });
  const d = await r.json();
  return NextResponse.json(d, { status: r.ok ? 200 : r.status });
}

export async function POST(req: Request) {
  const body = await req.json();
  const r = await fetch(`${process.env.API_BASE}/admin/notifications/templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ADMIN_TOKEN}`
    },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  return NextResponse.json(d, { status: r.ok ? 200 : r.status });
}
