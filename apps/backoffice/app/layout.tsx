export const metadata = { title: "Backoffice" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: "ui-sans-serif, system-ui", margin: 0 }}>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <aside style={{ width: 240, background: "#0f172a", color: "#fff", padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Backoffice</h2>
            <nav style={{ display: "grid", gap: 8 }}>
              <a href="/dashboard" style={{ color: "#fff" }}>Dashboard</a>
              <a href="/users" style={{ color: "#fff" }}>Kullanıcılar</a>
              <a href="/messages" style={{ color: "#fff" }}>Mesajlar</a>
              <a href="/members" style={{ color: "#fff" }}>Üyeler</a>
              <a href="/pending" style={{ color: "#fff" }}>Bekleyen Doğrulamalar</a>
              <a href="/raffle" style={{ color: "#fff" }}>Çekiliş Katılımcıları</a>
              <a href="/raffles" style={{ color: "#fff" }}>Özel Kampanyalar</a>
            </nav>
          </aside>
          <main style={{ flex: 1, padding: 24 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
