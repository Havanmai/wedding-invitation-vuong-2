// Verify the "Hộp Quà Mừng" gift-box popup on the saved chungdoi.com page.
//
//   node verify-giftbox.js red    -> expect: click does NOTHING (bug reproduced)
//   node verify-giftbox.js green  -> expect: click opens popup, X closes it
//
// Requires: serve.py running on :8123, playwright-core in artifacts/tools,
// system Edge as the browser. Exit code 0 = expectation met.
const { chromium } = require("playwright-core");

const MODE = process.argv[2] || "red";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = "http://127.0.0.1:8123/vuong.html?open=1";
const OUT_DIR = "D:/Learn/Vuong/artifacts/debug-fe";
const DIALOG_SELECTOR = "dialog.modal-bottom"; // unique on the page

(async () => {
  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--window-size=1280,900"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));

  await page.goto(URL, { waitUntil: "load" });

  // The main content wrapper stays [hidden] until a fallback timer unhides it
  // (~2s after load, since React hydration is disabled on this saved copy).
  const openBtn = page.locator('button[aria-label="Mở hộp mừng cưới"]');
  await openBtn.waitFor({ state: "visible", timeout: 15000 });
  await openBtn.scrollIntoViewIfNeeded();

  // Act like the user: a real mouse click on the button centre, not el.click().
  const box = await openBtn.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  const dialogState = await page
    .waitForFunction(
      (sel) => {
        const dlg = document.querySelector(sel);
        if (!dlg) return null;
        const heading = dlg.querySelector("h2");
        return {
          open: dlg.open,
          headingText: heading ? heading.textContent.trim() : null,
          headingVisible: !!heading && heading.offsetParent !== null,
        };
      },
      DIALOG_SELECTOR,
      { timeout: 3000 }
    )
    .then((handle) => handle.jsonValue())
    .catch(() => null);

  if (dialogState && dialogState.open) {
    // Let the daisyUI modal fade-in transition settle before screenshotting,
    // otherwise the popup is captured mid-animation and looks transparent.
    await page.waitForTimeout(700);
  }

  await page.screenshot({ path: `${OUT_DIR}/${MODE}-giftbox.png` });

  let closeResult = null;
  if (dialogState && dialogState.open) {
    // Close via the X button, like a user would.
    await page.locator(`${DIALOG_SELECTOR} button.btn-circle`).click();
    await page
      .waitForFunction(
        (sel) => !document.querySelector(sel).open,
        DIALOG_SELECTOR,
        { timeout: 3000 }
      )
      .then(() => {
        closeResult = false;
      })
      .catch(() => {
        closeResult = true; // still open -> close failed
      });
    // daisyUI plays a fade-out before display:none kicks in; wait it out so
    // the screenshot shows the popup actually gone.
    await page.waitForTimeout(1000);
    const visibleAfterClose = await page.evaluate(
      (sel) => document.querySelector(sel).offsetParent !== null,
      DIALOG_SELECTOR
    );
    if (visibleAfterClose) closeResult = "still-visible";
    await page.screenshot({ path: `${OUT_DIR}/${MODE}-giftbox-after-close.png` });
  }

  const passed =
    MODE === "red"
      ? dialogState !== null && dialogState.open === false
      : !!dialogState &&
        dialogState.open === true &&
        dialogState.headingVisible === true &&
        dialogState.headingText === "Hộp Quà Mừng" &&
        closeResult === false;

  console.log(
    JSON.stringify({ mode: MODE, dialogState, closeResult, consoleErrors, passed }, null, 2)
  );
  await browser.close();
  process.exit(passed ? 0 : 1);
})();
