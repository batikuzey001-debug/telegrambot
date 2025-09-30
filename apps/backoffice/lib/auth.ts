import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const COOKIE_NAME = "bo_token";

export function signSession(): string {
  const secret = process.env.JWT_SECRET!;
  return jwt.sign({ role: "admin" }, secret, { expiresIn: "12h" });
}

export function verifyFromCookie(): boolean {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return false;
    jwt.verify(token, process.env.JWT_SECRET!);
    return true;
  } catch {
    return false;
  }
}

export const cookieName = COOKIE_NAME;
