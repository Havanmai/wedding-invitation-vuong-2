// Headless verification of the invite-envelope cover in vuong.html.
// Drives Edge over the Chrome DevTools Protocol: loads the page, clicks the
// "Mở thiệp" button, and screenshots the burst + the revealed invitation.
const { spawn } = require("child_process");
const fs = require("fs");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9333;
const URL = "http://127.0.0.1:8123/vuong.html";
const OUT = "D:/Learn/Vuong/artifacts";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}

(async () => {
  const edge = spawn(EDGE, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1280,900",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=D:/Learn/Vuong/artifacts/.edge-profile",
    "about:blank",
  ], { stdio: "ignore" });

  let targets = null;
  for (let i = 0; i < 40 && !targets; i++) {
    await sleep(500);
    try {
      targets = await httpJson("/json/list");
    } catch (e) { /* not up yet */ }
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const msgId = ++id;
      pending.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result && res.result.result && res.result.result.value;
  };

  const shot = async (name) => {
    const res = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(`${OUT}/${name}`, Buffer.from(res.result.data, "base64"));
    console.log("wrote", name);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");

  const consoleErrors = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      consoleErrors.push(msg.params.entry.text);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      consoleErrors.push(
        "EXCEPTION: " +
          (msg.params.exceptionDetails.exception?.description ||
            msg.params.exceptionDetails.text)
      );
    }
  });

  await send("Page.navigate", { url: URL });
  await sleep(3000);

  const before = await evaluate(`(() => {
    const overlay = document.querySelector('[data-landing-screenshot-id="invite-envelope"]');
    const seal = overlay && overlay.querySelector('[style*="seal-pulse"]');
    return {
      overlayFound: !!overlay,
      overlayVisible: overlay ? getComputedStyle(overlay).display !== 'none' : false,
      overlayOpacity: overlay ? getComputedStyle(overlay).opacity : null,
      sealAnimation: seal ? getComputedStyle(seal).animationName : null,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
      bodyPaddingRight: document.body.style.paddingRight,
      buttonText: (document.querySelector('a[href*="open=1"]') || {}).textContent,
      animationNames: {
        ambientRise: !!getComputedStyle(document.body).getPropertyValue('--x') || undefined,
      },
    };
  })()`);
  console.log("BEFORE CLICK:", JSON.stringify(before, null, 2));

  const anim = await evaluate(`(() => {
    const names = ['ambient-rise','seal-pulse','shine','particle-burst','seal-ring','seal-break','envelope-away','seal-flower-bloom'];
    const out = {};
    for (const n of names) {
      out[n] = Array.from(document.styleSheets).some(sheet => {
        try { return Array.from(sheet.cssRules).some(r => r.type === 7 && r.name === n); }
        catch (e) { return false; }
      });
    }
    return out;
  })()`);
  console.log("KEYFRAMES DEFINED:", JSON.stringify(anim));

  // Click the button.
  await evaluate(`document.querySelector('a[href*="open=1"]').click()`);
  await sleep(320);
  await shot("envelope-01-burst.png");

  const mid = await evaluate(`(() => {
    const seal = document.querySelector('[style*="seal-break"]');
    const group = document.querySelector('div[style="z-index: 10"]');
    return {
      sealAnimation: seal ? getComputedStyle(seal).animationName : null,
      particles: document.querySelectorAll('span[style*="particle-burst"]').length,
      cardAnimation: group ? getComputedStyle(group).animationName : null,
      overlayOpacity: getComputedStyle(document.querySelector('[data-landing-screenshot-id="invite-envelope"]')).opacity,
    };
  })()`);
  console.log("DURING OPEN:", JSON.stringify(mid, null, 2));

  await sleep(1600);
  await shot("envelope-02-opened.png");

  const after = await evaluate(`(() => ({
    overlayRemoved: !document.querySelector('[data-landing-screenshot-id="invite-envelope"]'),
    htmlOverflow: document.documentElement.style.overflow,
    bodyPaddingRight: document.body.style.paddingRight,
    url: location.href,
    mainVisible: !!document.querySelector('main'),
    scrollHeight: document.documentElement.scrollHeight,
  }))()`);
  console.log("AFTER OPEN:", JSON.stringify(after, null, 2));

  console.log("CONSOLE ERRORS:", JSON.stringify(consoleErrors, null, 2));

  // ?open=1 must skip the cover entirely.
  await send("Page.navigate", { url: URL + "?open=1" });
  await sleep(2500);
  const skipped = await evaluate(`(() => ({
    overlayRemoved: !document.querySelector('[data-landing-screenshot-id="invite-envelope"]'),
    htmlOverflow: document.documentElement.style.overflow,
  }))()`);
  console.log("WITH ?open=1:", JSON.stringify(skipped, null, 2));
  await shot("envelope-03-open-param.png");

  ws.close();
  edge.kill();
})().catch((e) => {
  console.error("FAILED", e);
  process.exit(1);
});
