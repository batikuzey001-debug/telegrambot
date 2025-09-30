// apps/backoffice/app/api/messages/[key]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const api = process.env.API_BASE!;
const adminToken = process.env.ADMIN_TOKEN!;
const COOKIE = "bo_token";

export async function GET(_: Request, { params }: { params: { key: string } }) {
  try {
    const r = await fetch(`${api}/messages/${params.key}`, { cache: "no-store" });
    const data = await r.json().catch(() => ({ error: "bad_json" }));
    return NextResponse.json(data, { status: r.ok ? 200 : r.status });
  } catch (e: any) {
    return NextResponse.json({ error: "fetch_failed", detail: String(e) }, { status: 502 });
  }
}

export async function PUT(req: Request, { params }: { params: { key: string } }) {
  // Auth
  const token = cookies().get(COOKIE)?.value || "";
  try {
    jwt.verify(token, process.env.JWT_SECRET!);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Forward
  try {
    const body = await req.json();
    const r = await fetch(`${api}/admin/messages/${params.key}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({ error: "bad_json_from_api" }));
    // Başarı/hata bilgisini açık döndür
    return NextResponse.json(
      { ok: r.ok, status: r.status, data },
      { status: r.ok ? 200 : r.status }
    );
  } catch (e: any) {
    return NextResponse.json({ error: "proxy_failed", detail: String(e) }, { status: 502 });
  }
}
