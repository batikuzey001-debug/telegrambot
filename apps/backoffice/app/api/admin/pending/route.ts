import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "pending";
  const r = await fetch(`${process.env.API_BASE}/admin/pending-requests?status=${status}`, {
    headers: { "Authorization": `Bearer ${process.env.ADMIN_TOKEN}` },
    cache: "no-store"
  });
  const d = await r.json();
  return NextResponse.json(d, { status: r.ok ? 200 : r.status });
}
