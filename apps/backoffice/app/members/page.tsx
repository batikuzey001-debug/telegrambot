"use client";
import { useState } from "react";

export default function MembersImport() {
  const [json, setJson] = useState(`[{"membership_id":"10001","first_name":"Ali","last_name":"Yılmaz"}]`);
  const [msg, setMsg] = useState("");

  const send = async () => {
    setMsg("");
    try {
      const rows = JSON.parse(json);
      const r = await fetch("/api/admin/members/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows })
      });
      const d = await r.json();
      setMsg(r.ok ? `Yüklendi: ${d.count}` : `Hata: ${d.error || r.status}`);
    } catch {
      setMsg("JSON hatalı");
    }
  };

  return (
    <div>
      <h1>Üyelik Listesi Yükleme</h1>
      <p>JSON satırları: membership_id, first_name, last_name</p>
      <textarea rows={12} style={{ width: "100%" }} value={json} onChange={e=>setJson(e.target.value)} />
      <div style={{ marginTop: 8 }}>
        <button onClick={send}>Yükle</button> {msg}
      </div>
    </div>
  );
}
