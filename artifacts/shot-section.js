// Screenshot a section of vuong.html: node shot-section.js <cssSelector> <out.png> [padding]
const { spawn } = require("child_process");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9337;
const URL = "http://127.0.0.1:8123/vuong.html?open=1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SELECTOR = process.argv[2] || ".aspect-\\[268\\/317\\]";
const OUT = process.argv[3] || "D:/Learn/Vuong/artifacts/section.png";
const PAD = Number(process.argv[4] || 60);

(async () => {
  const edge = spawn(EDGE, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1280,900",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=D:/Learn/Vuong/artifacts/.edge-shot",
    "about:blank",
  ], { stdio: "ignore" });

  let targets = null;
  for (let i = 0; i < 40 && !targets; i++) {
    await sleep(500);
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch (e) {}
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => { const m = ++id; pending.set(m, resolve); ws.send(JSON.stringify({ id: m, method, params })); });
  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return res.result?.result?.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: URL });

  for (let i = 0; i < 40; i++) {
    const ok = await evaluate(`(() => {
      const o = document.querySelector('[data-landing-screenshot-id="invite-envelope"]');
      return !!o && getComputedStyle(o).position === 'fixed';
    })()`);
    if (ok) break;
    await sleep(250);
  }
  await sleep(1200);

  const box = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(SELECTOR)});
    if (!el) return null;
    el.scrollIntoView({block: 'center'});
    const r = el.getBoundingClientRect();
    // CDP's clip is in PAGE coordinates, so shift by the current scroll.
    return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY),
             w: Math.round(r.width), h: Math.round(r.height) };
  })()`);
  console.log("box:", JSON.stringify(box));
  await sleep(600);

  const clip = {
    x: Math.max(0, box.x - PAD),
    y: Math.max(0, box.y - PAD),
    width: Math.min(1256, box.w + PAD * 2),
    height: Math.min(808, box.h + PAD * 2),
    scale: 1,
  };
  const res = await send("Page.captureScreenshot", { format: "png", clip });
  require("fs").writeFileSync(OUT, Buffer.from(res.result.data, "base64"));
  console.log("wrote", OUT);

  ws.close();
  edge.kill();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
