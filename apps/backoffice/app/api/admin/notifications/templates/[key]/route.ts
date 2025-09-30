import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: { key: string } }) {
  const r = await fetch(`${process.env.API_BASE}/admin/notifications/templates/${params.key}`, {
    headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    cache: "no-store"
  });
  const d = await r.json();
  return NextResponse.json(d, { status: r.ok ? 200 : r.status });
}

export async function PUT(req: Request, { params }: { params: { key: string } }) {
  const body = await req.json();
  const r = await fetch(`${process.env.API_BASE}/admin/notifications/templates/${params.key}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ADMIN_TOKEN}`
    },
    body: JSON.stringify(body)
  });
  const d = await r.json();
  return NextResponse.json(d, { status: r.ok ? 200 : r.status });
}

export async function DELETE(_: Request, { params }: { params: { key: string } }) {
  const r = await fetch(`${process.env.API_BASE}/admin/notifications/templates/${params.key}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` }
  });
  const d = await r.json().catch(() => ({}));
  return NextResponse.json(d, { status: r.ok ? 200 : r.status });
}
