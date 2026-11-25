// Runs the Worker on a local port with an in-memory D1 (for end-to-end testing of the app).
import { createServer } from "node:http";
import worker from "../src/index";
import { makeD1 } from "./d1-sqlite";

const env = {
  ANTHROPIC_API_KEY: "test",
  ACCESS_CODES: "vip1",
  DB: makeD1(),
  RESEND_API_KEY: "mock",
  MAIL_FROM: "test@local",
};
// emails are written to the console instead of being sent
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any) => {
  if (String(url).includes("api.resend.com")) {
    console.log("MAIL", init.body);
    return new Response("{}", { status: 200 });
  }
  return realFetch(url, init);
}) as typeof fetch; // MOCK_MAIL
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
};
createServer(async (req, res) => {
  if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await worker.fetch(
    new Request("http://local" + req.url, { method: req.method, headers: req.headers as any, body }),
    env as any,
  );
  res.writeHead(r.status, { ...cors, "content-type": "application/json" }).end(await r.text());
}).listen(Number(process.env.PORT ?? 8787), () => console.log("listening"));
