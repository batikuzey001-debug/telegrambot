"use client";
import { useEffect, useMemo, useState } from "react";

type MessageRow = { key: string; content: string; image_url: string | null; file_id?: string | null; updated_at?: string; };

export default function MessagesPage() {
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<MessageRow | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/messages", { cache: "no-store" });
      if (!res.ok) throw new Error("list_failed");
      setRows(await res.json());
    } catch { alert("Mesajlar alınamadı."); } finally { setLoading(false); }
  }

  async function save() {
    if (!editing) return;
    try {
      const res = await fetch(`/api/admin/messages/${encodeURIComponent(editing.key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editing.content, image_url: editing.image_url || null }),
      });
      if (!res.ok) throw new Error("save_failed");
      setEditing(null); await load();
    } catch { alert("Kaydetme hatası."); }
  }

  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => r.key.toLowerCase().includes(s) || r.content.toLowerCase().includes(s) || (r.image_url || "").toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div style={{ padding: 16, maxWidth: 1000, margin: "0 auto" }}>
      <h1>📨 Mesajlar</h1>
      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <input placeholder="Ara: key / içerik / image url" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, padding: 8 }} />
        <button onClick={load} disabled={loading}>{loading ? "Yükleniyor..." : "Yenile"}</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}>Key</th><th style={th}>Content</th><th style={th}>Image URL</th><th style={th}>Güncel</th><th style={th}></th></tr></thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.key}>
              <td style={tdMono}>{r.key}</td>
              <td style={td}>{truncate(r.content, 120)}</td>
              <td style={td}>{r.image_url || ""}</td>
              <td style={td}>{r.updated_at ? new Date(r.updated_at).toLocaleString() : ""}</td>
              <td style={td}><button onClick={() => setEditing(r)}>Düzenle</button></td>
            </tr>
          ))}
          {!filtered.length && <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: "#666" }}>Kayıt yok.</td></tr>}
        </tbody>
      </table>

      {editing && (
        <div style={panel}>
          <h2 style={{ marginTop: 0 }}>Düzenle: <code>{editing.key}</code></h2>
          <label style={label}>Content</label>
          <textarea rows={6} style={input} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
          <label style={label}>Image URL (opsiyonel)</label>
          <input type="text" style={input} value={editing.image_url || ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} placeholder="https://..." />
          {editing.image_url ? <div style={{ margin: "8px 0" }}><img alt="preview" src={editing.image_url} style={{ maxWidth: "100%", maxHeight: 240, border: "1px solid #eee" }} /></div> : null}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save}>Kaydet</button>
            <button onClick={() => setEditing(null)}>Vazgeç</button>
          </div>
          <p style={{ color: "#666", fontSize: 12, marginTop: 8 }}>Not: Yeni <b>Image URL</b> kaydederseniz API ilgili mesajın <code>file_id</code>’ını sıfırlar.</p>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 };
const td: React.CSSProperties = { borderBottom: "1px solid #f0f0f0", padding: 8, verticalAlign: "top" };
const tdMono: React.CSSProperties = { ...td, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" };
const input: React.CSSProperties = { width: "100%", padding: 8 };
const label: React.CSSProperties = { display: "block", marginTop: 8, marginBottom: 4, fontWeight: 600 };
const panel: React.CSSProperties = { marginTop: 16, padding: 16, border: "1px solid #ddd", background: "#fafafa" };

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
