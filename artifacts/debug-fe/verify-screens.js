// Verify the two-screen setup of the saved chungdoi.com page.
//
//   node verify-screens.js
//
// screen 1 = /vuong.html        (envelope cover, CD audio icon on top)
// screen 2 = /vuong.html?open=1 (cover skipped, address bar cleaned)
// Any reload must land back on screen 1.
//
// S1: on screen 1 the CD button sits ABOVE the cover; clicking it starts the
//     music WITHOUT opening the envelope; opening the cover keeps /vuong.html.
// S2: entering ?open=1 shows screen 2, cleans the URL, reload -> screen 1.
// S3: opening the envelope on screen 1 keeps the URL, reload -> screen 1.
// Exit 0 = all assertions passed.
const { chromium } = require("playwright-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUT_DIR = "D:/Learn/Vuong/artifacts/debug-fe";
const BASE = "http://127.0.0.1:8123/vuong.html";
const OVERLAY = '[data-landing-screenshot-id="invite-envelope"]';
const CD_BUTTON = 'button[aria-label="Phát nhạc"], button[aria-label="Tạm dừng nhạc"]';

async function overlayPresent(page) {
  return page.evaluate((sel) => !!document.querySelector(sel), OVERLAY);
}

async function audioState(page) {
  return page.evaluate(() => {
    const audio = document.querySelector('audio[data-video-audio="true"]');
    return { muted: audio.muted, paused: audio.paused, currentTime: audio.currentTime };
  });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--window-size=1280,900"],
  });

  // ---- S1: CD above the cover, music without opening, URL stays clean
  const s1 = {};
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(2000);

    s1.overlayOnLoad = await overlayPresent(page);

    const cd = page.locator(CD_BUTTON).first();
    const box = await cd.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    s1.cdTopmost = await page.evaluate(
      ([x, y, sel]) => {
        const el = document.elementFromPoint(x, y);
        return !!el && !!document.querySelector(sel).contains(el);
      },
      [cx, cy, CD_BUTTON]
    );

    await page.mouse.click(cx, cy); // first gesture = the CD tap itself
    await page.waitForTimeout(1200);
    const afterCdClick = await audioState(page);
    s1.musicAudibleViaCd = afterCdClick.muted === false && afterCdClick.paused === false;
    s1.coverStillUpAfterCd = await overlayPresent(page); // CD click must NOT open it

    await page.locator(OVERLAY).click(); // now open the envelope
    await page.waitForTimeout(2500);
    s1.urlAfterOpen = page.url();
    const afterOpen = await audioState(page);
    s1.musicStillPlayingAfterOpen = afterOpen.paused === false;
    s1.coverGoneAfterOpen = (await overlayPresent(page)) === false;
    await page.screenshot({ path: `${OUT_DIR}/green-screens-s1.png` });
    await page.close();
  }

  // ---- S2: ?open=1 is screen 2, URL cleaned, reload -> screen 1
  const s2 = {};
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + "?open=1", { waitUntil: "load" });
    await page.waitForTimeout(1000);
    s2.coverSkipped = (await overlayPresent(page)) === false;
    s2.urlCleaned = page.url() === BASE;

    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(2000);
    s2.reloadShowsCover = await overlayPresent(page);
    await page.close();
  }

  // ---- S3: opening the envelope keeps /vuong.html; reload -> screen 1
  const s3 = {};
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    await page.locator(OVERLAY).click();
    await page.waitForTimeout(2500);
    s3.urlAfterOpenHasNoParam = page.url() === BASE;

    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(2000);
    s3.reloadShowsCover = await overlayPresent(page);
    await page.close();
  }

  await browser.close();

  const passed =
    s1.overlayOnLoad &&
    s1.cdTopmost &&
    s1.musicAudibleViaCd &&
    s1.coverStillUpAfterCd &&
    s1.coverGoneAfterOpen &&
    s1.urlAfterOpen === BASE &&
    s1.musicStillPlayingAfterOpen &&
    s2.coverSkipped &&
    s2.urlCleaned &&
    s2.reloadShowsCover &&
    s3.urlAfterOpenHasNoParam &&
    s3.reloadShowsCover;

  console.log(JSON.stringify({ passed, s1, s2, s3 }, null, 2));
  process.exit(passed ? 0 : 1);
})();
