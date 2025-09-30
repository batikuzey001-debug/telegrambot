"use client";
import { useEffect, useMemo, useState } from "react";

type Msg = { key: string; content: string; image_url?: string | null; updated_at?: string };

export default function MessagesPage() {
  const [items, setItems] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string>("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("");

  // liste
  useEffect(() => {
    fetch("/api/messages")
      .then(r => r.json())
      .then((data: Msg[]) => {
        setItems(data);
        if (data.length && !sel) {
          setSel(data[0].key);
          setContent(data[0].content || "");
          setImageUrl(data[0].image_url || "");
        }
      });
  }, []);

  // seçim değişince formu doldur
  useEffect(() => {
    const m = items.find(x => x.key === sel);
    if (m) {
      setContent(m.content || "");
      setImageUrl(m.image_url || "");
      setStatus("");
    }
  }, [sel, items]);

  const filtered = useMemo(
    () => items.filter(i => i.key.toLowerCase().includes(q.toLowerCase())),
    [items, q]
  );

  async function save() {
    setStatus("Kaydediliyor...");
    const res = await fetch(`/api/messages/${sel}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, image_url: imageUrl || null })
    });
    setStatus(res.ok ? "Kaydedildi. Bot cache temizlendi." : "Hata");
    if (res.ok) {
      // listeyi yerelde güncelle
      setItems(prev => prev.map(x => x.key === sel ? { ...x, content, image_url: imageUrl } : x));
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
      {/* Sol liste + arama */}
      <aside style={{ borderRight: "1px solid #eee", paddingRight: 12 }}>
        <h2>Mesajlar</h2>
        <input
          placeholder="Ara (key)"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <div style={{ maxHeight: "70vh", overflow: "auto", border: "1px solid #eee" }}>
          {filtered.map(m => (
            <div
              key={m.key}
              onClick={() => setSel(m.key)}
              style={{
                padding: 8,
                cursor: "pointer",
                background: sel === m.key ? "#eef2ff" : "transparent",
                borderBottom: "1px solid #eee"
              }}
            >
              <div style={{ fontWeight: 600 }}>{m.key}</div>
              <div style={{ fontSize: 12, color: "#555" }}>{m.updated_at ? new Date(m.updated_at).toLocaleString() : ""}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* Sağ düzenleme + basit “Telegram” önizleme */}
      <section style={{ display: "grid", gap: 12 }}>
        <h2>{sel || "Seçim yapın"}</h2>

        <label>İçerik</label>
        <textarea rows={8} value={content} onChange={e => setContent(e.target.value)} />

        <label>Görsel URL</label>
        <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} disabled={!sel}>Kaydet</button>
          {status && <span>{status}</span>}
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{
            width: 360, border: "1px solid #ddd", borderRadius: 8, padding: 12,
            background: "#f8fafc"
          }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Telegram Önizleme</div>
            {imageUrl ? (
              <figure>
                {/* Basit img preview */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="preview" style={{ width: "100%", borderRadius: 6 }} />
                <figcaption style={{ marginTop: 6 }}>{content}</figcaption>
              </figure>
            ) : (
              <p style={{ whiteSpace: "pre-wrap" }}>{content}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
