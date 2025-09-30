import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const api = process.env.API_BASE!;
const adminToken = process.env.ADMIN_TOKEN!;
const COOKIE = "bo_token";

export async function GET(_: Request, { params }: { params: { key: string } }) {
  const r = await fetch(`${api}/messages/${params.key}`, { cache: "no-store" });
  const data = await r.json();
  return NextResponse.json(data, { status: r.ok ? 200 : r.status });
}

export async function PUT(req: Request, { params }: { params: { key: string } }) {
  const token = cookies().get(COOKIE)?.value || "";
  try { jwt.verify(token, process.env.JWT_SECRET!); } catch { return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  const body = await req.json();
  const r = await fetch(`${api}/admin/messages/${params.key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  return NextResponse.json(data, { status: r.ok ? 200 : r.status });
}
