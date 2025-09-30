import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signSession, cookieName } from "@/lib/auth";

export async function POST(req: Request) {
  const { username, password } = await req.json();
  if (username !== process.env.ADMIN_USER || password !== process.env.ADMIN_PASS) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = signSession();
  cookies().set(cookieName, token, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 12, path: "/" });
  return NextResponse.json({ ok: true });
}
