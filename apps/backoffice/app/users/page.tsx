"use client";
import { useEffect, useMemo, useState } from "react";

type UserRow = {
  id: number;
  external_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  membership_id: string | null;
  tg_first_name?: string | null;
  tg_last_name?: string | null;
  tg_username?: string | null;
  submitted_username?: string | null;
  status: "member" | "pending" | "guest" | string;
};

async function getUsers(): Promise<UserRow[]> {
  const r = await fetch("/api/users", { cache: "no-store" });
  if (!r.ok) return [];
  return r.json();
}

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  // manual add form
  const [externalId, setExternalId] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [submittedUsername, setSubmittedUsername] = useState("");
  const [tgFirst, setTgFirst] = useState("");
  const [tgLast, setTgLast] = useState("");
  const [tgUser, setTgUser] = useState("");

  const load = async () => {
    setMsg("Yükleniyor...");
    const data = await getUsers();
    setRows(data);
    setMsg("");
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter(r =>
      r.external_id.includes(q) ||
      (r.membership_id || "").includes(q) ||
      (r.first_name || "").toLowerCase().includes(s) ||
      (r.last_name || "").toLowerCase().includes(s) ||
      (r.tg_first_name || "").toLowerCase().includes(s) ||
      (r.tg_last_name || "").toLowerCase().includes(s) ||
      (r.tg_username || "").toLowerCase().includes(s) ||
      (r.submitted_username || "").toLowerCase().includes(s) ||
      (r.status || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  const badge = (st: string) => {
    const color =
      st === "member" ? "#16a34a" :
      st === "pending" ? "#f59e0b" :
      "#64748b";
    return (
      <span style={{ padding: "2px 8px", borderRadius: 999, background: color, color: "#fff", fontSize: 12 }}>
        {st}
      </span>
    );
  };

  async function addUser() {
    setMsg("");
    if (!externalId || !membershipId || !submittedUsername) {
      setMsg("Zorunlu alanlar: Telegram ID, Üyelik ID, Kullanıcı adı");
      return;
    }
    try {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          external_id: externalId.trim(),
          membership_id: membershipId.trim(),
          submitted_username: submittedUsername.trim(),
          tg_first_name: tgFirst || null,
          tg_last_name: tgLast || null,
          tg_username: tgUser || null
        })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg(`Ekleme hatası: ${d.error || r.status}`);
        return;
      }
      setExternalId(""); setMembershipId(""); setSubmittedUsername("");
      setTgFirst(""); setTgLast(""); setTgUser("");
      setMsg("Kullanıcı eklendi/güncellendi");
      load();
    } catch {
      setMsg("Ağ hatası");
    }
  }

  async function deleteUser(external_id: string) {
    if (!confirm(`Silinsin mi? Telegram ID: ${external_id}`)) return;
    setMsg("");
    try {
      // Not: Bu endpointin backoffice proxy'si olmalı: /api/admin/users/delete (external_id)
      const r = await fetch("/api/admin/users/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ external_id })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg(`Silme hatası: ${d.error || r.status}`);
        return;
      }
      setMsg("Kullanıcı silindi");
      load();
    } catch {
      setMsg("Ağ hatası");
    }
  }

  return (
    <div>
      <h1>Kullanıcılar</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <input
          placeholder="Ara: ID, ad, soyad, üyelik, durum, @username"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 420 }}
        />
        <button onClick={load}>Yenile</button>
        {msg && <span>{msg}</span>}
      </div>

      {/* Manuel ekleme / güncelleme */}
      <div style={{ border: "1px solid #e5e7eb", padding: 12, borderRadius: 8, marginBottom: 16 }}>
        <h3>Manuel Ekle / Güncelle</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <input placeholder="Telegram ID *" value={externalId} onChange={e=>setExternalId(e.target.value)} />
          <input placeholder="Üyelik ID *" value={membershipId} onChange={e=>setMembershipId(e.target.value)} />
          <input placeholder="Kullanıcı adı (yazdığı) *" value={submittedUsername} onChange={e=>setSubmittedUsername(e.target.value)} />
          <input placeholder="Telegram Ad (opsiyonel)" value={tgFirst} onChange={e=>setTgFirst(e.target.value)} />
          <input placeholder="Telegram Soyad (opsiyonel)" value={tgLast} onChange={e=>setTgLast(e.target.value)} />
          <input placeholder="Telegram Username (opsiyonel)" value={tgUser} onChange={e=>setTgUser(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={addUser}>Kaydet</button>
        </div>
      </div>

      <table border={1} cellPadding={6} style={{ borderCollapse: "collapse", width: "100%", marginTop: 12 }}>
        <thead>
          <tr>
            <th>#</th>
            <th>Telegram ID</th>
            <th>Ad</th>
            <th>Soyad</th>
            <th>Üyelik ID</th>
            <th>Telegram Ad</th>
            <th>Telegram Soyad</th>
            <th>Telegram Username</th>
            <th>Yazdığı Kullanıcı Adı</th>
            <th>Durum</th>
            <th>İşlem</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.external_id}</td>
              <td>{u.first_name ?? "-"}</td>
              <td>{u.last_name ?? "-"}</td>
              <td>{u.membership_id ?? "-"}</td>
              <td>{u.tg_first_name ?? "-"}</td>
              <td>{u.tg_last_name ?? "-"}</td>
              <td>{u.tg_username ? `@${u.tg_username}` : "-"}</td>
              <td>{u.submitted_username ?? "-"}</td>
              <td>{badge(u.status)}</td>
              <td>
                <button onClick={() => deleteUser(u.external_id)} style={{ color: "red" }}>
                  Sil
                </button>
              </td>
            </tr>
          ))}
          {!filtered.length && (
            <tr>
              <td colSpan={11} style={{ textAlign: "center", color: "#667085" }}>
                Kayıt yok
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
