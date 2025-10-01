// services/api/index.js
import express from "express";
import { initDb } from "./db.js";
import { makeAuth } from "./middleware/auth.js";
import { messagesRouter } from "./routes/messages.js";
import { usersRouter } from "./routes/users.js";
import { membersRouter } from "./routes/members.js";
import { rafflesRouter } from "./routes/raffles.js";
import { notificationsRouter } from "./routes/notifications.js";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const app = express();
app.use(express.json());

const auth = makeAuth(ADMIN_TOKEN);

// health
app.get("/", (_req, res) => res.json({ ok: true }));

// routes
app.use("/messages", messagesRouter(auth));                  // /messages, /messages/:key, /messages/admin/:key, /messages/bot/:key/file-id
app.use("/users", usersRouter());                            // /users...
app.use("/", membersRouter(auth));                           // /members/:id, /admin/members/import, /pending-requests, ...
app.use("/", rafflesRouter(auth));                           // /raffle/enter, /raffles/active, /raffles/admin...
app.use("/admin/notifications", notificationsRouter(auth));  // /admin/notifications/templates, /admin/notifications/send ...

// 404
app.use((req, res) => res.status(404).json({ error: "not_found" }));

// error handler
app.use((err, _req, res, _next) => {
  console.error("API error:", err);
  res.status(500).json({ error: "internal_error" });
});

const port = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(port, () => console.log(`API on :${port}`)))
  .catch((e) => {
    console.error("DB init error", e);
    process.exit(1);
  });
