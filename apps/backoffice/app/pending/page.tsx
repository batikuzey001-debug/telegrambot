"use client";
import { useEffect, useState } from "react";

type Pending = { id:number; external_id:string; provided_membership_id?:string|null; full_name:string; status:string; created_at:string };

export default function PendingPage() {
  const [items, setItems] = useState<Pending[]>([]);
  const [msg, setMsg] = useState("");
  const [mid, setMid] = useState("");

  const load = async () => {
    setMsg("");
    const r = await fetch("/api/admin/pending?status=pending");
    const d = await r.json();
    setItems(r.ok ? d : []);
  };

  useEffect(()=>{ load(); }, []);

  const act = async (id:number, action:"approve"|"reject") => {
    setMsg("");
    const body: any = { action };
    if (action === "approve") body.membership_id = mid;
    const r = await fetch(`/api/admin/pending/${id}`, {
      method: "PUT",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(body)
    });
    if (r.ok && action==="approve" && mid) {
      // eşle
      const item = items.find(i=>i.id===id);
      if (item) {
        await fetch("/api/admin/users/link", {
          method: "PUT",
          headers: { "Content-Type":"application/json" },
          body: JSON.stringify({ external_id: item.external_id, membership_id: mid })
        });
      }
    }
    setMsg(r.ok ? "Güncellendi" : "Hata");
    setMid("");
    load();
  };

  return (
    <div>
      <h1>Bekleyen Doğrulamalar</h1>
      <div style={{ marginBottom: 8 }}>
        <input placeholder="Onay için üyelik ID" value={mid} onChange={e=>setMid(e.target.value)} />
      </div>
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
                <button onClick={()=>act(p.id,"approve")} disabled={!mid}>Onayla</button>
                <button onClick={()=>act(p.id,"reject")}>Reddet</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
