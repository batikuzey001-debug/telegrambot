import express from "express";
import crypto from "node:crypto";
import { initDb } from "./db.js";
import { makeAuth } from "./middleware/auth.js";
import { messagesRouter } from "./routes/messages.js";
import { usersRouter } from "./routes/users.js";
import { membersRouter } from "./routes/members.js";
import { rafflesRouter } from "./routes/raffles.js";
import { dmRouter } from "./routes/dm.js"; // <-- sadece DM

console.log("BOOT FROM:", import.meta.url);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const app = express();
app.disable("x-powered-by");
app.use(express.json());

// log
app.use((req,_res,next)=>{ req._rid=crypto.randomUUID(); const p=req.method!=="GET"? (JSON.stringify(req.body)||"").slice(0,500):""; console.log(`[REQ ${req._rid}] ${req.method} ${req.url} ${p}`); next(); });

app.get("/",(_req,res)=>res.json({ok:true}));
app.get("/_whoami",(_req,res)=>res.json({boot:import.meta.url,time:new Date().toISOString()}));

const auth = makeAuth(ADMIN_TOKEN);

// routes (notifications YOK)
app.use("/messages", messagesRouter(auth));
app.use("/users", usersRouter(auth));
app.use("/", membersRouter(auth));
app.use("/", rafflesRouter(auth));
app.use("/", dmRouter(auth)); // POST /admin/dm

app.use((req,res)=>res.status(404).json({error:"not_found"}));
app.use((err,req,res,_next)=>{const pg=err?.code?{code:err.code,detail:err.detail,where:err.where,position:err.position}:null;console.error(`[ERR ${req._rid||"-"}]`,err?.message||err,pg||"");res.status(500).json({error:"internal_error",rid:req._rid||"-"});});

const port = process.env.PORT || 3000;
initDb().then(()=>app.listen(port,()=>console.log(`API on :${port}`))).catch(e=>{console.error("DB init error",e);process.exit(1);});
