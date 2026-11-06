const { spawn } = require("child_process");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9338;
const URL = "http://127.0.0.1:8123/vuong.html?open=1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const edge = spawn(EDGE, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1280,900",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=D:/Learn/Vuong/artifacts/.edge-inspect",
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
    if (msg.method === "Network.loadingFailed") {
      console.log("LOAD FAILED:", msg.params.errorText, msg.params.type);
    }
    if (msg.method === "Network.responseReceived" && msg.params.response.status >= 400) {
      console.log("HTTP", msg.params.response.status, msg.params.response.url);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => { const m = ++id; pending.set(m, resolve); ws.send(JSON.stringify({ id: m, method, params })); });
  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (res.result?.exceptionDetails) {
      console.log("EVAL ERR:", res.result.exceptionDetails.exception?.description);
      return null;
    }
    return res.result?.result?.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.navigate", { url: URL });
  await sleep(4000);

  console.log(await evaluate(`(() => {
    const root = document.querySelector('.aspect-\\\\[268\\\\/317\\\\]');
    if (!root) return 'root not found';
    const r = (el) => { const b = el.getBoundingClientRect(); return {x:Math.round(b.left),y:Math.round(b.top),w:Math.round(b.width),h:Math.round(b.height)}; };
    const kids = Array.from(root.children).map(el => {
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName,
        cls: (el.className||'').toString().slice(0, 90),
        rect: r(el),
        position: cs.position, left: cs.left, top: cs.top, width: cs.width, height: cs.height,
        z: cs.zIndex, transform: cs.transform,
        animationName: cs.animationName,
        src: el.getAttribute('src') || (el.querySelector('img') ? el.querySelector('img').getAttribute('src') : null),
        imgComplete: el.tagName === 'IMG' ? el.complete : null,
        imgNatural: el.tagName === 'IMG' ? [el.naturalWidth, el.naturalHeight] : null,
      };
    });
    const cs = getComputedStyle(root);
    return JSON.stringify({
      rootRect: r(root),
      rootAspect: cs.aspectRatio,
      rootPosition: cs.position,
      rootWidth: cs.width, rootHeight: cs.height,
      rootOffsetH: root.offsetHeight,
      parentRect: r(root.parentElement),
      parentClass: root.parentElement.className.toString().slice(0,120),
      kids,
    }, null, 2);
  })()`));

  ws.close();
  edge.kill();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
