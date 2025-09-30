import { NextResponse } from "next/server";

export async function GET() {
  const r = await fetch(`${process.env.API_BASE}/raffles/active`, { cache: "no-store" });
  const d = await r.json();
  return NextResponse.json(d, { status: r.ok ? 200 : r.status });
}
