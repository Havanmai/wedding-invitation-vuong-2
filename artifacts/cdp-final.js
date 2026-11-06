// Final check: real mouse input (not .click()) on the seal and on the CTA.
const { spawn } = require("child_process");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9335;
const URL = "http://127.0.0.1:8123/vuong.html";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const edge = spawn(EDGE, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1280,900",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=D:/Learn/Vuong/artifacts/.edge-profile3",
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

  const mouseClick = async (x, y) => {
    for (const type of ["mousePressed", "mouseReleased"]) {
      await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
      await sleep(30);
    }
  };

  // Wait until the Tailwind bundle has actually been applied - before that the
  // overlay is unstyled and every measured rect is meaningless.
  const waitForStyles = async () => {
    for (let i = 0; i < 40; i++) {
      const ok = await evaluate(`(() => {
        const o = document.querySelector('[data-landing-screenshot-id="invite-envelope"]');
        if (!o || getComputedStyle(o).position !== 'fixed') return false;
        const s = o.querySelector('[style*="seal-pulse"]');
        if (!s) return false;
        const b = s.getBoundingClientRect();
        // Layout settled only once the seal sits inside the viewport.
        return b.width > 10 && b.top > 0 && b.bottom < innerHeight;
      })()`);
      if (ok) return true;
      await sleep(250);
    }
    throw new Error("styles never applied");
  };

  await send("Page.enable");
  await send("Runtime.enable");

  // --- Pass 1: click the SEAL ---
  await send("Page.navigate", { url: URL });
  await waitForStyles();
  await sleep(400);
  const sealBox = await evaluate(`(() => {
    const s = document.querySelector('[style*="seal-pulse"]');
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  })()`);
  console.log("seal box:", JSON.stringify(sealBox));
  await mouseClick(sealBox.x, sealBox.y);
  await sleep(1800);
  console.log("after seal click -> overlay removed:",
    await evaluate(`!document.querySelector('[data-landing-screenshot-id="invite-envelope"]')`));

  // --- Pass 2: click the "Mở thiệp" button ---
  await send("Page.navigate", { url: URL });
  await waitForStyles();
  await sleep(400);
  const btnBox = await evaluate(`(() => {
    const b = document.querySelector('a[href*="open=1"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  })()`);
  console.log("button box:", JSON.stringify(btnBox));
  await mouseClick(btnBox.x, btnBox.y);
  await sleep(1800);
  console.log("after button click -> overlay removed:",
    await evaluate(`!document.querySelector('[data-landing-screenshot-id="invite-envelope"]')`));
  console.log("after button click -> url:",
    await evaluate(`location.href`));
  console.log("after button click -> page scrollable:",
    await evaluate(`document.documentElement.style.overflow === '' && document.documentElement.scrollHeight > 1000`));

  // --- Pass 3: click the dark backdrop ---
  await send("Page.navigate", { url: URL });
  await waitForStyles();
  await sleep(400);
  await mouseClick(60, 60);
  await sleep(1800);
  console.log("after backdrop click -> overlay removed:",
    await evaluate(`!document.querySelector('[data-landing-screenshot-id="invite-envelope"]')`));

  ws.close();
  edge.kill();
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
