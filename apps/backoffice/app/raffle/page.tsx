// apps/backoffice/app/raffle/page.tsx  (katılımcılar sayfası – doğru isimler ve daha zengin tablo)
"use client";
import { useEffect, useState } from "react";

type Entry = {
  id: number;
  external_id: string;
  created_at: string;
  membership_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  tg_first_name?: string | null;
  tg_last_name?: string | null;
  tg_username?: string | null;
  submitted_username?: string | null;
};

type Raffle = { key: string; title: string };

export default function RaffleParticipantsPage() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [msg, setMsg] = useState("");
  const [key, setKey] = useState("default_raffle");
  const [raffles, setRaffles] = useState<Raffle[]>([]);

  async function loadRaffles() {
    const r = await fetch("/api/admin/raffles/active").catch(() => null);
    if (!r) return;
    const d: Raffle[] = await r.json();
    setRaffles(Array.isArray(d) ? d : []);
  }

  async function load() {
    setMsg("Yükleniyor...");
    const r = await fetch(`/api/admin/raffle/entries?key=${encodeURIComponent(key)}`, {
      cache: "no-store",
    }).catch(() => null);
    if (!r) { setMsg("Ağ hatası"); return; }
    const d = await r.json();
    if (!r.ok) { setMsg(`Hata: ${d?.error || r.status}`); setRows([]); return; }
    setRows(Array.isArray(d) ? d : []);
    setMsg("");
  }

  useEffect(() => { loadRaffles(); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [key]);

  return (
    <div>
      <h1>Kampanya Katılımcıları</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <label>Kampanya:</label>
        <select value={key} onChange={(e)=>setKey(e.target.value)}>
          {[{ key: "default_raffle", title: "Genel Çekiliş" }, ...raffles]
            .filter((v,i,self)=> self.findIndex(x=>x.key===v.key)===i)
            .map(r => <option key={r.key} value={r.key}>{r.title} ({r.key})</option>)
          }
        </select>
        <button onClick={load}>Yenile</button>
        {msg && <span>{msg}</span>}
      </div>

      <table border={1} cellPadding={6} style={{ borderCollapse:"collapse", width:"100%" }}>
        <thead>
          <tr>
            <th>#</th>
            <th>Telegram ID</th>
            <th>Ad</th>
            <th>Soyad</th>
            <th>Üyelik ID</th>
            <th>Telegram Ad</th>
            <th>Telegram Soyad</th>
            <th>@username</th>
            <th>Yazdığı Kullanıcı Adı</th>
            <th>Tarih</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.external_id}</td>
              <td>{r.first_name || "-"}</td>
              <td>{r.last_name || "-"}</td>
              <td>{r.membership_id || "-"}</td>
              <td>{r.tg_first_name || "-"}</td>
              <td>{r.tg_last_name || "-"}</td>
              <td>{r.tg_username ? `@${r.tg_username}` : "-"}</td>
              <td>{r.submitted_username || "-"}</td>
              <td>{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={10} style={{ textAlign:"center", color:"#667085" }}>Kayıt yok</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
