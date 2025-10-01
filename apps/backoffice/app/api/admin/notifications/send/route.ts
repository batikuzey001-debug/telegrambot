// apps/backoffice/app/api/admin/notifications/send/route.ts
import { NextRequest, NextResponse } from "next/server";
const trim = (s?: string | null) => (s ?? "").toString().trim();
const API_URL = trim(process.env.API_URL) || trim(process.env.API_BASE) || trim(process.env.NEXT_PUBLIC_API_URL);
const ADMIN_TOKEN = trim(process.env.ADMIN_TOKEN) || trim(process.env.NEXT_PUBLIC_ADMIN_TOKEN);

export async function POST(req: NextRequest) {
  if (!API_URL || !ADMIN_TOKEN) return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  const src = await req.json();
  const body: any = { key: trim(src.key) };
  if (!body.key) return NextResponse.json({ error: "key_required" }, { status: 400 });
  if (Array.isArray(src.external_ids) && src.external_ids.length) body.external_ids = src.external_ids.map((x: any) => String(x));
  else if (src.segment === "all_members" || src.segment === "all_users") body.segment = src.segment;
  else if (Array.isArray(src.membership_ids) && src.membership_ids.length) body.membership_ids = src.membership_ids.map(String);
  else if (src.membership_prefix) body.membership_prefix = String(src.membership_prefix);
  else return NextResponse.json({ error: "no_targets" }, { status: 400 });

  const r = await fetch(`${API_URL}/admin/notifications/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  return new NextResponse(txt, { status: r.status, headers: { "Content-Type": r.headers.get("content-type") || "application/json" } });
}
