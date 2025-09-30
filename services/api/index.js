import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ ok: true, message: "API skeleton running" });
});

// Kullanıcı upsert
app.post("/users", async (req, res) => {
  const { external_id, name, membership_id } = req.body;
  if (!external_id) return res.status(400).json({ error: "external_id required" });

  const query = `
    INSERT INTO users (external_id, name, membership_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (external_id) 
    DO UPDATE SET name = EXCLUDED.name, membership_id = EXCLUDED.membership_id, updated_at = now()
    RETURNING id, external_id, name, membership_id;
  `;
  const { rows } = await pool.query(query, [external_id, name || null, membership_id || null]);
  res.json(rows[0]);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
