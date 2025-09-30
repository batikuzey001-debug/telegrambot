import { NextResponse } from "next/server";
export async function GET() {
  const r = await fetch(`${process.env.API_BASE}/users`, { cache: "no-store" });
  const data = await r.json();
  return NextResponse.json(data, { status: r.ok ? 200 : r.status });
}
