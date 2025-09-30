"use client";
import { useState } from "react";

export default function Login() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p })
    });
    if (res.ok) location.href = "/dashboard";
    else setErr("Giriş başarısız");
  };
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <form onSubmit={submit} style={{ width: 320, display: "grid", gap: 12 }}>
        <h1>Backoffice Giriş</h1>
        <input placeholder="Kullanıcı adı" value={u} onChange={e=>setU(e.target.value)} />
        <input placeholder="Şifre" type="password" value={p} onChange={e=>setP(e.target.value)} />
        <button type="submit">Giriş</button>
        {err && <div style={{ color: "red" }}>{err}</div>}
      </form>
    </div>
  );
}
