const { spawn } = require("child_process");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9339;
const URL = "http://127.0.0.1:8123/vuong.html?open=1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WIDTH = Number(process.argv[2] || 390);
const HEIGHT = Number(process.argv[3] || 844);
const OUT = process.argv[4] || "D:/Learn/Vuong/artifacts/cluster-mobile.png";
const TAG = process.argv[5] || "mobile";

(async () => {
  const edge = spawn(EDGE, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    `--window-size=${WIDTH},${HEIGHT}`,
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=D:/Learn/Vuong/artifacts/.edge-cluster",
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
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH < 700,
  });
  await send("Page.navigate", { url: URL });
  await sleep(3500);

  // Wait for the envelope cluster to be laid out.
  for (let i = 0; i < 40; i++) {
    const ok = await evaluate(`(() => {
      const el = document.querySelector('.aspect-\\\\[268\\\\/317\\\\]');
      return !!el && el.getBoundingClientRect().height > 50;
    })()`);
    if (ok) break;
    await sleep(250);
  }

  console.log(await evaluate(`(() => {
    const root = document.querySelector('.aspect-\\\\[268\\\\/317\\\\]');
    const r = (el) => { const b = el.getBoundingClientRect(); return {x:Math.round(b.left),y:Math.round(b.top),w:Math.round(b.width),h:Math.round(b.height)}; };
    const photos = Array.from(root.querySelectorAll(':scope > div'));
    return JSON.stringify({
      viewport: innerWidth,
      root: r(root),
      rootLeft: Math.round(root.getBoundingClientRect().left),
      photos: photos.map(p => ({
        cls: p.className,
        rect: r(p),
        animationName: getComputedStyle(p).animationName,
        duration: getComputedStyle(p).animationDuration,
        transform: getComputedStyle(p).transform,
      })),
    }, null, 2);
  })()`));

  // Scroll it into view and shoot.
  const box = await evaluate(`(() => {
    const el = document.querySelector('.aspect-\\\\[268\\\\/317\\\\]');
    el.scrollIntoView({block: 'center'});
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.left + scrollX), y: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height) };
  })()`);
  await sleep(500);
  const clip = {
    x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 40),
    width: Math.min(WIDTH, box.w + 80), height: Math.min(HEIGHT, box.h + 80), scale: 1,
  };
  const res = await send("Page.captureScreenshot", { format: "png", clip });
  require("fs").writeFileSync(OUT, Buffer.from(res.result.data, "base64"));
  console.log("wrote", OUT);

  ws.close();
  edge.kill();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
