"use client";
import { useEffect, useMemo, useState } from "react";

type Tpl = {
  key: string;
  title: string;
  content: string;
  image_url?: string | null;
  buttons?: Array<{ text: string; url: string }>;
  active: boolean;
  updated_at?: string;
};

export default function Notifications() {
  const [items, setItems] = useState<Tpl[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string>("");
  const [form, setForm] = useState<Tpl>({
    key: "",
    title: "",
    content: "",
    image_url: "",
    buttons: [],
    active: true,
  });
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("Yükleniyor...");
    const r = await fetch("/api/admin/notifications/templates", { cache: "no-store" });
    if (!r.ok) { setMsg("Liste alınamadı"); setItems([]); return; }
    const arr = (await r.json()) as Tpl[];
    setItems(arr);
    setMsg("");
    if (arr.length && !sel) {
      setSel(arr[0].key);
      setForm(arr[0] as Tpl);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const m = items.find(i => i.key === sel);
    if (m) setForm(m as Tpl);
  }, [sel, items]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return items.filter(i => i.key.toLowerCase().includes(s) || i.title.toLowerCase().includes(s));
  }, [items, q]);

  async function create() {
    setMsg("");
    const body = {
      key: form.key.trim(),
      title: form.title.trim(),
      content: form.content,
      image_url: form.image_url || null,
      active: form.active,
    };
    const r = await fetch("/api/admin/notifications/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setMsg(r.ok ? "Oluşturuldu" : "Hata");
    await load();
  }

  async function save() {
    if (!sel) return;
    setMsg("");
    const body = {
      title: form.title.trim(),
      content: form.content,
      image_url: form.image_url || null,
      active: form.active,
    };
    const r = await fetch(`/api/admin/notifications/templates/${encodeURIComponent(sel)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setMsg(r.ok ? "Güncellendi" : "Hata");
    await load();
  }

  async function remove() {
    if (!sel) return;
    const r = await fetch(`/api/admin/notifications/templates/${encodeURIComponent(sel)}`, { method: "DELETE" });
    setMsg(r.ok ? "Silindi" : "Silme hatası");
    setSel("");
    await load();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
      <aside style={{ borderRight: "1px solid #eee", paddingRight: 12 }}>
        <h2>Şablonlar</h2>
        <input
          placeholder="Ara (key veya başlık)"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ width: "100%", marginBottom: 8 }}
        />
        <div style={{ maxHeight: "70vh", overflow: "auto", border: "1px solid #eee" }}>
          {filtered.map(m => (
            <div
              key={m.key}
              onClick={() => setSel(m.key)}
              style={{ padding: 8, cursor: "pointer", background: sel === m.key ? "#eef2ff" : "transparent", borderBottom: "1px solid #eee" }}
            >
              <div style={{ fontWeight: 600 }}>{m.key}</div>
              <div style={{ fontSize: 12, color: "#555" }}>{m.title}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {m.updated_at ? new Date(m.updated_at).toLocaleString() : ""}
              </div>
            </div>
          ))}
          {!filtered.length && <div style={{ padding: 8, color: "#666" }}>Kayıt yok</div>}
        </div>
        <button
          onClick={() => { setSel(""); setForm({ key: "", title: "", content: "", image_url: "", buttons: [], active: true }); }}
          style={{ marginTop: 8 }}
        >
          Yeni Şablon
        </button>
      </aside>

      <section style={{ display: "grid", gap: 12 }}>
        <h2>{sel ? `Düzenle: ${sel}` : "Yeni Şablon"}</h2>

        {!sel && (
          <>
            <label>Key</label>
            <input value={form.key} onChange={e => setForm({ ...form, key: e.target.value })} placeholder="ornek_kampanya_ekim" />
          </>
        )}

        <label>Başlık</label>
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Kampanya Başlığı" />

        <label>İçerik</label>
        <textarea rows={8} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />

        <label>Görsel URL</label>
        <input value={form.image_url || ""} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />

        <div style={{ padding: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <b>Butonlar sabit:</b>
          <ul>
            <li>Radissonbet Güncel Giriş → <code>GUNCEL_GIRIS_URL</code></li>
            <li>Ücretsiz Etkinlik • Bonus • Promosyon Kodları → <code>SOCIAL_URL</code></li>
            <li>Bana Özel Fırsatlar → <code>BOT_MEMBER_DEEPLINK</code></li>
          </ul>
          <small>Not: Kişiselleştirme bot tarafından otomatik eklenir: “Sayın Ad Soyad,”</small>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
          Aktif
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          {sel ? (
            <>
              <button onClick={save}>Kaydet</button>
              <button onClick={remove} style={{ color: "red" }}>Sil</button>
            </>
          ) : (
            <button onClick={create} disabled={!form.key || !form.title || !form.content}>Oluştur</button>
          )}
          {msg && <span>{msg}</span>}
        </div>

        {/* Önizleme */}
        <div style={{ marginTop: 16 }}>
          <div style={{ width: 360, border: "1px solid #ddd", borderRadius: 8, padding: 12, background: "#f8fafc" }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Telegram Önizleme</div>
            {form.image_url ? (
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_url} alt="preview" style={{ width: "100%", borderRadius: 6 }} />
                <figcaption style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                  <b>{form.title}</b>{"\n"}{"Sayın Ad Soyad,\n\n"}{form.content}
                </figcaption>
              </figure>
            ) : (
              <p style={{ whiteSpace: "pre-wrap" }}>
                <b>{form.title}</b>{"\n"}{"Sayın Ad Soyad,\n\n"}{form.content}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
