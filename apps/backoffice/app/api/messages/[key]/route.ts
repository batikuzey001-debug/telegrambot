import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: { key: string } }) {
  try {
    const r = await fetch(`${process.env.API_BASE}/messages/${params.key}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({ error: "bad_json" }));
    return NextResponse.json(d, { status: r.ok ? 200 : r.status });
  } catch (e: any) {
    return NextResponse.json({ error: "fetch_failed", detail: String(e) }, { status: 502 });
  }
}

export async function PUT(req: Request, { params }: { params: { key: string } }) {
  try {
    const body = await req.json();
    const r = await fetch(`${process.env.API_BASE}/admin/messages/${params.key}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
      },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({ error: "bad_json_from_api" }));
    // UI'nın net görmesi için ok/status/invalidated alanları döndür.
    return NextResponse.json({ ok: r.ok, status: r.status, ...d }, { status: r.ok ? 200 : r.status });
  } catch (e: any) {
    return NextResponse.json({ error: "proxy_failed", detail: String(e) }, { status: 502 });
  }
}
