"use client";
import { useEffect, useState } from "react";

type Pending = { id:number; external_id:string; provided_membership_id?:string|null; full_name:string; status:string; created_at:string };

export default function PendingPage() {
  const [items, setItems] = useState<Pending[]>([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");
    const r = await fetch("/api/admin/pending?status=pending");
    const d = await r.json();
    setItems(r.ok ? d : []);
  };

  useEffect(()=>{ load(); }, []);

  const approve = async (p: Pending) => {
    setMsg("");
    const r1 = await fetch(`/api/admin/pending/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" })
    });
    const d1 = await r1.json();
    if (!r1.ok) { setMsg("Onay hatası"); return; }

    // Kullanıcıya bildirim
    const r2 = await fetch("/api/admin/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        external_id: d1.external_id || p.external_id,
        text: "✅ Üyeliğiniz onaylanmıştır. Hoş geldiniz!"
      })
    });

    setMsg(r2.ok ? "Onaylandı ve bildirildi" : "Onaylandı, bildirim hatası");
    load();
  };

  const reject = async (p: Pending) => {
    setMsg("");
    const r = await fetch(`/api/admin/pending/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" })
    });
    setMsg(r.ok ? "Reddedildi" : "Reddetme hatası");
    load();
  };

  return (
    <div>
      <h1>Bekleyen Doğrulamalar</h1>
      <table border={1} cellPadding={6} style={{ borderCollapse:"collapse", width:"100%" }}>
        <thead><tr><th>ID</th><th>Telegram ID</th><th>Yazılan ID</th><th>Ad Soyad</th><th>Tarih</th><th>İşlem</th></tr></thead>
        <tbody>
          {items.map(p=>(
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.external_id}</td>
              <td>{p.provided_membership_id || "-"}</td>
              <td>{p.full_name}</td>
              <td>{new Date(p.created_at).toLocaleString()}</td>
              <td style={{ display:"flex", gap:8 }}>
                <button onClick={()=>approve(p)}>Onayla</button>
                <button onClick={()=>reject(p)}>Reddet</button>
              </td>
            </tr>
          ))}
          {!items.length && <tr><td colSpan={6} style={{ textAlign:"center", color:"#666" }}>Bekleyen talep yok</td></tr>}
        </tbody>
      </table>
      {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
