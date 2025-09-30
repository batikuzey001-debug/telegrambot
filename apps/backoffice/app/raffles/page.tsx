"use client";
import { useEffect, useState } from "react";

type R = { key: string; title: string; active: boolean };

export default function Raffles() {
  const [rows, setRows] = useState<R[]>([]);
  const [key, setKey] = useState("");
  const [title, setTitle] = useState("");
  const [active, setActive] = useState(true);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");
    const r = await fetch("/api/admin/raffles/active");
    const d = await r.json();
    if (r.ok) setRows(d); else setMsg("Hata");
  };

  useEffect(()=>{ load(); }, []);

  const createRaffle = async () => {
    setMsg("");
    const r = await fetch("/api/admin/raffles", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ key, title, active })
    });
    setMsg(r.ok ? "Oluşturuldu" : "Hata veya mevcut");
    setKey(""); setTitle(""); setActive(true);
    load();
  };

  const toggle = async (rk: string, cur: boolean) => {
    setMsg("");
    const r = await fetch(`/api/admin/raffles/${rk}`, {
      method: "PUT",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ active: !cur })
    });
    setMsg(r.ok ? "Güncellendi" : "Hata");
    load();
  };

  return (
    <div>
      <h1>Özel Kampanyalar</h1>
      <h3>Yeni Kampanya</h3>
      <div style={{ display:"flex", gap:8 }}>
        <input placeholder="key" value={key} onChange={e=>setKey(e.target.value)} />
        <input placeholder="title" value={title} onChange={e=>setTitle(e.target.value)} />
        <label style={{display:"flex",alignItems:"center",gap:6}}>
          <input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)} /> aktif
        </label>
        <button onClick={createRaffle} disabled={!key || !title}>Oluştur</button>
      </div>

      <h3 style={{marginTop:16}}>Aktif Kampanyalar</h3>
      <table border={1} cellPadding={6} style={{ borderCollapse:"collapse", width:"100%" }}>
        <thead><tr><th>Key</th><th>Başlık</th><th>Durum</th><th>İşlem</th></tr></thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.key}>
              <td>{r.key}</td>
              <td>{r.title}</td>
              <td>{r.active ? "aktif" : "pasif"}</td>
              <td><button onClick={()=>toggle(r.key, r.active)}>{r.active ? "Pasifleştir" : "Aktifleştir"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {msg && <div style={{marginTop:8}}>{msg}</div>}
    </div>
  );
}
