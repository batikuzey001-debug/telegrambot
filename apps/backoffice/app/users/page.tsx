"use client";
import { useEffect, useMemo, useState } from "react";

type User = {
  id: number;
  external_id: string;
  first_name: string | null;
  last_name: string | null;
  membership_id: string | null;
  tg_username: string | null;
  submitted_username: string | null;
  status: "member" | "pending" | "guest";
};

export default function UsersPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState<User | null>(null);
  const [form, setForm] = useState<Partial<User>>({});

  async function load() {
    setMsg("Yükleniyor…");
    try {
      const r = await fetch("/api/users?ts=" + Date.now(), { cache: "no-store" });
      const d = await r.json();
      setRows(Array.isArray(d) ? d : []);
      setMsg("");
    } catch {
      setMsg("Liste alınamadı");
    }
  }
  useEffect(() => { load(); }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(u =>
      (u.external_id || "").toLowerCase().includes(s) ||
      (u.first_name || "").toLowerCase().includes(s) ||
      (u.last_name || "").toLowerCase().includes(s) ||
      (u.membership_id || "").toLowerCase().includes(s) ||
      (u.tg_username || "").toLowerCase().includes(s) ||
      (u.submitted_username || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  async function doDelete(external_id: string) {
    if (!confirm("Silinsin mi?")) return;
    setMsg("");
    const r = await fetch(`/api/admin/users/${encodeURIComponent(external_id)}`, { method: "DELETE" });
    if (!r.ok) { setMsg("Silme hatası"); return; }
    setMsg("Silindi");
    await load();
  }

  function openEdit(u: User) {
    setEdit(u);
    setForm({
      membership_id: u.membership_id || "",
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      tg_username: u.tg_username || "",
      submitted_username: u.submitted_username || "",
    });
  }

  async function saveEdit() {
    if (!edit) return;
    setMsg("");
    const r = await fetch(`/api/admin/users/${encodeURIComponent(edit.external_id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!r.ok) { setMsg("Güncelleme hatası"); return; }
    setEdit(null);
    await load();
  }

  return (
    <div>
      <h1>Kullanıcılar</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ara" style={{ flex: 1, padding: 8 }} />
        <button onClick={load}>Yenile</button>
        {msg && <span>{msg}</span>}
      </div>

      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr>
            <th style={th}>Ext ID</th>
            <th style={th}>Ad</th>
            <th style={th}>Soyad</th>
            <th style={th}>RB ID</th>
            <th style={th}>TG</th>
            <th style={th}>Durum</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {list.map(u=>(
            <tr key={u.id}>
              <td style={tdMono}>{u.external_id}</td>
              <td style={td}>{u.first_name||""}</td>
              <td style={td}>{u.last_name||""}</td>
              <td style={td}>{u.membership_id||""}</td>
              <td style={td}>{u.tg_username||""}</td>
              <td style={td}>{u.status}</td>
              <td style={td}>
                <button onClick={()=>openEdit(u)}>Düzenle</button>{" "}
                <button onClick={()=>doDelete(u.external_id)} style={{ color:"red" }}>Sil</button>
              </td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={7} style={{ padding:12, color:"#666" }}>Kayıt yok</td></tr>}
        </tbody>
      </table>

      {edit && (
        <div style={panel}>
          <h3>Düzenle: <code>{edit.external_id}</code></h3>
          <label>RB Üyelik ID</label>
          <input value={form.membership_id as string || ""} onChange={e=>setForm(f=>({ ...f, membership_id: e.target.value }))} />
          <label>Ad</label>
          <input value={form.first_name as string || ""} onChange={e=>setForm(f=>({ ...f, first_name: e.target.value }))} />
          <label>Soyad</label>
          <input value={form.last_name as string || ""} onChange={e=>setForm(f=>({ ...f, last_name: e.target.value }))} />
          <label>Telegram Username</label>
          <input value={form.tg_username as string || ""} onChange={e=>setForm(f=>({ ...f, tg_username: e.target.value }))} />
          <label>Gönderdiği Kullanıcı Adı</label>
          <input value={form.submitted_username as string || ""} onChange={e=>setForm(f=>({ ...f, submitted_username: e.target.value }))} />
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button onClick={saveEdit}>Kaydet</button>
            <button onClick={()=>setEdit(null)}>Kapat</button>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { textAlign:"left", borderBottom:"1px solid #ddd", padding:8 };
const td: React.CSSProperties = { borderBottom:"1px solid #f1f5f9", padding:8, verticalAlign:"top" };
const tdMono: React.CSSProperties = { ...td, fontFamily:"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" };
const panel: React.CSSProperties = { marginTop:16, padding:12, border:"1px solid #ddd", background:"#fafafa", maxWidth:480 };
