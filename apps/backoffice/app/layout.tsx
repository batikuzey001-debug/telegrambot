// apps/backoffice/app/layout.tsx
export const metadata = { title: "Backoffice" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: "ui-sans-serif, system-ui", margin: 0 }}>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <aside style={{ width: 260, background: "#0f172a", color: "#fff", padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Backoffice</h2>
            <nav style={{ display: "grid", gap: 8 }}>
              <a href="/dashboard" style={linkStyle}>Dashboard</a>
              <a href="/users" style={linkStyle}>Kullanıcılar</a>
              <a href="/members" style={linkStyle}>Üyeler</a>
              <a href="/pending" style={linkStyle}>Bekleyen Doğrulamalar</a>
              <a href="/raffles" style={linkStyle}>Kampanyalar</a>
              <a href="/raffle" style={linkStyle}>Kampanya Katılımcıları</a>
              <a href="/admin/messages" style={linkStyle}>Mesajlar</a>
              <div style={{ height: 8, borderBottom: "1px solid #1f2937", margin: "8px 0" }} />
              <a href="/admin/dm" style={linkStyle}>Kişiye Özel Mesaj</a>
            </nav>
          </aside>
          <main style={{ flex: 1, padding: 24 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}

const linkStyle: React.CSSProperties = { color: "#fff", textDecoration: "none" };
