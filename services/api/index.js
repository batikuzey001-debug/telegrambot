"use client";
import { useEffect, useMemo, useState } from "react";

type Row = {
  id: number;
  external_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  membership_id: string | null;
  status: "member" | "pending" | "guest";
};

export default function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [notifyText, setNotifyText] = useState("");
  const [target, setTarget] = useState<string>("");

  const load = async () => {
    setMsg("Yükleniyor...");
    const r = await fetch("/api/users", { cache: "no-store" });
    const d = await r.json();
    setRows(Array.isArray(d) ? d : []);
    setMsg("");
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter(r =>
      r.external_id.includes(q) ||
      (r.first_name || "").toLowerCase().includes(s) ||
      (r.last_name || "").toLowerCase().includes(s) ||
      (r.membership_id || "").includes(q) ||
      r.status.toLowerCase().includes(s)
    );
  }, [rows, q]);

  const badge = (st: Row["status"]) => {
    const map: any = { member: "#16a34a", pending: "#f59e0b", guest: "#64748b" };
    return <span style={{ padding: "2px 8px", borderRadius: 999, background: map[st], color: "#fff", fontSize: 12 }}>{st}</span>;
  };

  const sendNotify = async () => {
    if (!target || !notifyText) return;
    setMsg("Bildirim gönderiliyor...");
    const r = await fetch("/api/admin/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ external_id: target, text: notifyText })
    });
    setMsg(r.ok ? "Bildirim gönderildi" : "Bildirim hatası");
    setNotifyText("");
    setTarget("");
  };

  return (
    <div>
      <h1>Kullanıcılar</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input
          placeholder="Ara: ID, ad, soyad, üyelik, durum"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ width: 420 }}
        />
        <button onClick={load}>Yenile</button>
        {msg && <span>{msg}</span>}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input placeholder="Telegram ID" value={target} onChange={e => setTarget(e.target.value)} />
        <input placeholder="Mesaj" value={notifyText} onChange={e => setNotifyText(e.target.value)} style={{ width: 360 }} />
        <button onClick={sendNotify} disabled={!target || !notifyText}>Bildirim Gönder</button>
      </div>

      <table border={1} cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>Kullanıcı ID</th>
            <th>Telegram ID</th>
            <th>İsim</th>
            <th>Soyisim</th>
            <th>Üyelik ID</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.external_id}</td>
              <td>{r.first_name || "-"}</td>
              <td>{r.last_name || "-"}</td>
              <td>{r.membership_id || "-"}</td>
              <td>{badge(r.status)}</td>
            </tr>
          ))}
          {!filtered.length && (
            <tr><td colSpan={6} style={{ textAlign: "center", color: "#666" }}>Kayıt yok</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
