async function getUsers() {
  const res = await fetch(`${process.env.API_BASE}/users`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export default async function UsersPage() {
  const users: Array<{id:number; external_id:string; name:string|null; membership_id:string|null}> = await getUsers();
  return (
    <div>
      <h1>Kullanıcılar</h1>
      <table border={1} cellPadding={6} style={{ borderCollapse: "collapse", width: "100%", marginTop: 12 }}>
        <thead>
          <tr>
            <th>ID</th><th>Telegram ID</th><th>Ad</th><th>Üyelik ID</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u=>(
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.external_id}</td>
              <td>{u.name ?? "-"}</td>
              <td>{u.membership_id ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
