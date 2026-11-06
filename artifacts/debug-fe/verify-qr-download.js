// Verify the "Lưu QR" anchors inside the "Hộp Quà Mừng" popup actually
// download the QR images.
//
//   node verify-qr-download.js
//
// Opens the popup via the gift box, clicks each "Lưu QR" anchor, and asserts
// a download fires with the expected filename. Exit 0 = both passed.
const { chromium } = require("playwright-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = "http://127.0.0.1:8123/vuong.html?open=1";
const OUT_DIR = "D:/Learn/Vuong/artifacts/debug-fe";

const EXPECTED = [
  { href: "./assets/images/vuong.png", filename: "QR-Chu-Re-Dinh-Duc-Vuong.png" },
  { href: "./assets/images/nhan.png", filename: "QR-Co-Dau-Bui-Thi-Nhan.png" },
];

(async () => {
  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--window-size=1280,900"],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  await page.goto(URL, { waitUntil: "load" });

  // Open the popup through the gift box button (exercises giftbox.js too).
  const openBtn = page.locator('button[aria-label="Mở hộp mừng cưới"]');
  await openBtn.waitFor({ state: "visible", timeout: 15000 });
  await openBtn.scrollIntoViewIfNeeded();
  const box = await openBtn.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector("dialog.modal-bottom[open]", { timeout: 3000 });
  await page.waitForTimeout(700);

  const results = [];
  for (const expected of EXPECTED) {
    const anchor = page.locator(`dialog.modal-bottom a[download="${expected.filename}"]`);
    const href = await anchor.getAttribute("href");
    try {
      const downloadPromise = page.waitForEvent("download", { timeout: 5000 });
      await anchor.click();
      const download = await downloadPromise;
      const path = `${OUT_DIR}/qr-${expected.filename}`;
      await download.saveAs(path);
      results.push({
        href,
        expected: expected.filename,
        suggestedFilename: download.suggestedFilename(),
        saved: true,
      });
    } catch (err) {
      results.push({ href, expected: expected.filename, error: String(err).split("\n")[0] });
    }
  }

  await page.screenshot({ path: `${OUT_DIR}/green-qr-popup.png` });
  const passed =
    results.length === EXPECTED.length &&
    results.every(
      (r, i) => r.saved && r.suggestedFilename === EXPECTED[i].filename
    );

  console.log(JSON.stringify({ passed, results }, null, 2));
  await browser.close();
  process.exit(passed ? 0 : 1);
})();
