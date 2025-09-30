import { NextResponse } from "next/server";

export async function GET() {
  const apiBase = process.env.API_BASE!;
  const admin = process.env.ADMIN_TOKEN!;
  try {
    const r = await fetch(`${apiBase}/admin/messages`, {
      headers: { Authorization: `Bearer ${admin}` },
      cache: "no-store"
    });
    // Sunucu tarafı log (Railway Backoffice logs)
    console.log("[/api/messages] upstream", {
      apiBase,
      status: r.status,
      ok: r.ok
    });
    const data = await r.json().catch(() => ({ error: "bad_json_from_api" }));
    if (!r.ok) {
      return NextResponse.json(
        { error: "upstream_error", status: r.status, apiBase, data },
        { status: 500 }
      );
    }
    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    console.error("[/api/messages] fetch error", e?.message || e);
    return NextResponse.json(
      { error: "fetch_failed", apiBase, detail: String(e) },
      { status: 500 }
    );
  }
}
