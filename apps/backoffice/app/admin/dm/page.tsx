"use client";
import { useState } from "react";

export default function DMPage() {
  const [externalId, setExternalId] = useState("");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [msg, setMsg] = useState(""); const [busy,setBusy]=useState(false);

  async function sendDM(){
    setMsg(""); if(!externalId.trim()||!text.trim()){ setMsg("Gerekli alanlar boş"); return; }
    setBusy(true);
    const r = await fetch("/api/admin/dm",{ method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ external_id: externalId.trim(), text, image_url: imageUrl.trim()||null, buttons: [] })});
    const j = await r.json().catch(()=>({}));
    setBusy(false); setMsg(r.ok? "Gönderildi" : `Hata: ${j?.error||r.status}`);
  }

  return (
    <div style={{maxWidth:560}}>
      <h1>Kişiye Özel Mesaj</h1>
      <label>Telegram External ID</label>
      <input value={externalId} onChange={e=>setExternalId(e.target.value)} placeholder="7625879536" style={{width:"100%",marginBottom:8}} />
      <label>Mesaj (HTML destekli)</label>
      <textarea rows={6} value={text} onChange={e=>setText(e.target.value)} style={{width:"100%",marginBottom:8}} />
      <label>Görsel URL (opsiyonel)</label>
      <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..." style={{width:"100%",marginBottom:12}} />
      <button onClick={sendDM} disabled={busy}>{busy?"Gönderiliyor…":"Gönder"}</button>
      {msg && <div style={{marginTop:8}}>{msg}</div>}
    </div>
  );
}
