// services/api/index.js
import express from "express";
import { initDb } from "./db.js";
import { makeAuth } from "./middleware/auth.js";
import { messagesRouter } from "./routes/messages.js";
import { usersRouter } from "./routes/users.js";
import { membersRouter } from "./routes/members.js";
import { rafflesRouter } from "./routes/raffles.js";
import { notificationsRouter } from "./routes/notifications.js";
import crypto from "node:crypto";

console.log("BOOT FROM:", import.meta.url);

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const app = express();
app.use(express.json());

// ---- REQ logger (RID + method + url + body özet) ----
app.use((req, _res, next) => {
  req._rid = crypto.randomUUID();
  const bodyPreview =
    req.method !== "GET" ? JSON.stringify(req.body)?.slice(0, 500) : "";
  console.log(`[REQ ${req._rid}] ${req.method} ${req.url} ${bodyPreview}`);
  next();
});

// hızlı teşhis için
app.get("/_whoami", (_req, res) => res.json({
  boot: import.meta.url,
  time: new Date().toISOString(),
}));

const auth = makeAuth(ADMIN_TOKEN);

// health
app.get("/", (_req, res) => res.json({ ok: true }));

// routes
app.use("/messages", messagesRouter(auth));
app.use("/users", usersRouter(auth));     // DELETE/PATCH admin uçları içerir
app.use("/", membersRouter(auth));
app.use("/", rafflesRouter(auth));
app.use("/admin/notifications", notificationsRouter(auth));

// 404
app.use((req, res) => res.status(404).json({ error: "not_found" }));

// ---- Gelişmiş error handler (PG detaylarıyla) ----
app.use((err, req, res, _next) => {
  const rid = req._rid || "-";
  // pg hata alanları: code, detail, where, position
  const pg = err && err.code ? {
    code: err.code,
    detail: err.detail,
    where: err.where,
    position: err.position,
  } : null;

  console.error(`[ERR ${rid}]`, err?.message || err, pg || "");
  if (process.env.NODE_ENV !== "production") {
    return res.status(500).json({
      error: "internal_error",
      rid,
      message: err?.message || String(err),
      pg,
    });
  }
  return res.status(500).json({ error: "internal_error", rid });
});

const port = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(port, () => console.log(`API on :${port}`)))
  .catch((e) => {
    console.error("DB init error", e);
    process.exit(1);
  });
