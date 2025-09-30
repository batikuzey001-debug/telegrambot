import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const r = await fetch(`${process.env.API_BASE}/admin/raffles`, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${process.env.ADMIN_TOKEN}` },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  return NextResponse.json(d, { status: r.ok ? 200 : r.status });
}

export async function GET() {
  const r = await fetch(`${process.env.API_BASE}/raffles/active`, { cache: "no-store" });
  const d = await r.json();
  return NextResponse.json(d, { status: r.ok ? 200 : r.status });
}
