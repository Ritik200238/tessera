// Regenerates the downloadable PDFs in public/ from the live /litepaper and /deck
// pages, so the committed PDFs stay in sync with the site copy.
//
// Why a script (and not the headless `--print-to-pdf` CLI): that CLI ignores
// @media print here, so it renders the on-screen layout. The DevTools Protocol
// `Page.printToPDF` renders with print media, which is what we want.
//
// Prerequisites (run from web/):
//   1. npm run build && npm run start        # serve the production build on :3000
//   2. chrome --headless --disable-gpu \      # a Chrome/Edge with remote debugging
//        --remote-debugging-port=9222 --user-data-dir=<temp>
//   3. node scripts/render-pdf.mjs
//
// Both pages hide site chrome on print (print:hidden) and the deck is laid out
// one slide per page (.deck-slide in globals.css).

import { writeFileSync } from "node:fs";

const CDP = "http://127.0.0.1:9222";
const ORIGIN = process.env.SITE_ORIGIN ?? "http://localhost:3000";
const TARGETS = [
  { url: `${ORIGIN}/litepaper`, out: "public/tessera-litepaper.pdf" },
  { url: `${ORIGIN}/deck`, out: "public/tessera-deck.pdf" },
];

const ver = await (await fetch(`${CDP}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);

let nextId = 1;
const pending = new Map();
const send = (method, params = {}, sessionId) => {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
};

const loadWaiters = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  }
  if (m.method === "Page.loadEventFired") loadWaiters.shift()?.();
});
await new Promise((r) => ws.addEventListener("open", r));

for (const { url, out } of TARGETS) {
  const onLoad = new Promise((r) => loadWaiters.push(r));
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Page.navigate", { url }, sessionId);
  await onLoad;
  await new Promise((r) => setTimeout(r, 1800)); // fonts + client render settle
  const { data } = await send(
    "Page.printToPDF",
    {
      printBackground: true,
      preferCSSPageSize: false,
      scale: 1,
      paperWidth: 8.27,
      paperHeight: 11.69,
      marginTop: 0.39,
      marginBottom: 0.39,
      marginLeft: 0.39,
      marginRight: 0.39,
    },
    sessionId,
  );
  writeFileSync(out, Buffer.from(data, "base64"));
  await send("Target.closeTarget", { targetId });
  console.log("wrote", out);
}

ws.close();
process.exit(0);
