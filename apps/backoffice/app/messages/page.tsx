"use client";
import { useEffect, useState } from "react";

const KEYS = ["welcome", "not_member", "events"];

export default function MessagesPage() {
  const [key, setKey] = useState("events");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setMsg("");
    fetch(`/api/messages/${key}`)
      .then(r => r.ok ? r.json() : { content: "", image_url: "" })
      .then(d => { setContent(d.content || ""); setImageUrl(d.image_url || ""); });
  }, [key]);

  const save = async () => {
    setMsg("");
    const res = await fetch(`/api/messages/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, image_url: imageUrl })
    });
    setMsg(res.ok ? "Kaydedildi ve bot cache invalidated." : "Hata");
  };

  return (
    <div>
      <h1>Mesajlar</h1>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label>Mesaj anahtarı:</label>
        <select value={key} onChange={e=>setKey(e.target.value)}>
          {KEYS.map(k=><option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gap: 8, marginTop: 12, maxWidth: 640 }}>
        <label>İçerik</label>
        <textarea rows={6} value={content} onChange={e=>setContent(e.target.value)} />
        <label>Görsel URL</label>
        <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..." />
        <button onClick={save}>Kaydet</button>
        {msg && <div>{msg}</div>}
      </div>
    </div>
  );
}
