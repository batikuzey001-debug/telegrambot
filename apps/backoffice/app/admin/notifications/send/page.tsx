"use client";

import { useEffect, useMemo, useState } from "react";

type Tpl = {
  key: string;
  title: string;
  content: string;
  image_url?: string | null;
  updated_at?: string;
};

export default function SendNotificationsPage() {
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string>("");
  const [segment, setSegment] = useState<"all_members" | "all_users" | "custom">("custom");
  const [ids, setIds] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setMsg("Şablonlar yükleniyor…");
    const r = await fetch("/api/admin/notifications/templates", { cache: "no-store" });
    if (!r.ok) { setMsg("Liste alınamadı"); setTpls([]); return; }
    const arr = await r.json();
    setTpls(arr);
    if (!sel && arr.length) setSel(arr[0].key);
    setMsg("");
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return tpls.filter(t => t.key.toLowerCase().includes(s) || (t.title||"").toLowerCase().includes(s));
  }, [tpls, q]);

  async function sendNow() {
    setMsg("");
    if (!sel) { setMsg("Şablon seçin"); return; }
    if (segment === "custom") {
      const external_ids = ids.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
      if (!external_ids.length) { setMsg("En az bir kullanıcı ID girin"); return; }
      await callSend({ key: sel, external_ids });
      return;
    }
    await callSend({ key: sel, segment });
  }

  async function callSend(body: any) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(`Hata: ${data?.error || r.status}`); return; }
      setMsg(`Gönderildi: ${data.ok}/${data.total} başarı, ${data.fail} hata`);
    } catch {
      setMsg("Hata: gönderim başarısız");
    } finally {
      setBusy(false);
    }
  }

  const selTpl = tpls.find(t => t.key === sel) || null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
      <aside style={{ borderRight: "1px solid #eee", paddingRight: 12 }}>
        <h2>Şablonlar</h2>
        <input
          placeholder="Ara (key / başlık)"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <div style={{ maxHeight: "70vh", overflow: "auto", border: "1px solid #eee" }}>
          {filtered.map(m => (
            <div key={m.key}
                 onClick={() => setSel(m.key)}
                 style={{
                   padding: 8, cursor: "pointer",
                   background: sel === m.key ? "#eef2ff" : "transparent",
                   borderBottom: "1px solid #eee"
                 }}>
              <div style={{ fontWeight: 600 }}>{m.key}</div>
              <div style={{ fontSize: 12, color: "#555" }}>{m.title}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {m.updated_at ? new Date(m.updated_at).toLocaleString() : ""}
              </div>
            </div>
          ))}
          {!filtered.length && <div style={{ padding: 8, color: "#666" }}>Kayıt yok</div>}
        </div>
      </aside>

      <section style={{ display: "grid", gap: 12 }}>
        <h2>Bildirim Gönder</h2>

        <div>
          <label style={{ fontWeight: 600 }}>Seçili Şablon</label>
          <div><code>{sel || "-"}</code></div>
        </div>

        <div>
          <label style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Hedef</label>
          <div style={{ display: "grid", gap: 6 }}>
            <label><input type="radio" name="seg" checked={segment==="custom"} onChange={()=>setSegment("custom")} /> Tekil kullanıcı(lar)</label>
            <label><input type="radio" name="seg" checked={segment==="all_members"} onChange={()=>setSegment("all_members")} /> Tüm üyeler</label>
            <label><input type="radio" name="seg" checked={segment==="all_users"} onChange={()=>setSegment("all_users")} /> Tüm kullanıcılar</label>
          </div>
        </div>

        {segment==="custom" && (
          <div>
            <label style={{ fontWeight: 600 }}>Kullanıcı ID listesi (boşluk/virgül/yeni satır ayrılmış)</label>
            <textarea rows={4} value={ids} onChange={e=>setIds(e.target.value)} style={{ width:"100%" }} placeholder="12345, 67890&#10;112233" />
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={sendNow} disabled={busy || !sel}>
            {busy ? "Gönderiliyor…" : "Gönder"}
          </button>
          {msg && <span>{msg}</span>}
        </div>

        {/* Önizleme */}
        <div style={{ marginTop: 16 }}>
          <div style={{ width: 420, border: "1px solid #ddd", borderRadius: 8, padding: 12, background: "#f8fafc" }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Telegram Önizleme</div>
            {selTpl?.image_url ? (
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selTpl.image_url} alt="preview" style={{ width: "100%", borderRadius: 6 }} />
                <figcaption style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                  <b>{selTpl?.title}</b>{"\n"}{"Sayın Ad Soyad,\n\n"}{selTpl?.content}
                </figcaption>
              </figure>
            ) : (
              <p style={{ whiteSpace: "pre-wrap" }}>
                <b>{selTpl?.title}</b>{"\n"}{"Sayın Ad Soyad,\n\n"}{selTpl?.content}
              </p>
            )}
            <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
              Butonlar sabittir: Güncel Giriş • Ücretsiz Etkinlik • Bonus • Promosyon Kodları • Bana Özel Fırsatlar
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
