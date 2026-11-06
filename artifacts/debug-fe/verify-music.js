// Verify the background music widget on the saved chungdoi.com page.
//
//   node verify-music.js
//
// The track is pre-started MUTED on load (browsers allow that without a
// gesture) and becomes audible at the guest's first interaction:
// Scenario A (?open=1): first click anywhere unmutes; the CD button
//   pauses/resumes afterwards.
// Scenario B (no param): the envelope-open tap unmutes mid-animation.
// Exit 0 = all assertions passed.
const { chromium } = require("playwright-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUT_DIR = "D:/Learn/Vuong/artifacts/debug-fe";
const BASE = "http://127.0.0.1:8123/vuong.html";

async function audioState(page) {
  return page.evaluate(() => {
    const audio = document.querySelector('audio[data-video-audio="true"]');
    // The CD button flips between exactly these two labels.
    const button = document.querySelector(
      'button[aria-label="Tạm dừng nhạc"], button[aria-label="Phát nhạc"]'
    );
    const spin = button ? button.querySelector('[class*="animate-spin-cd"]') : null;
    return {
      muted: audio.muted,
      paused: audio.paused,
      currentTime: audio.currentTime,
      src: audio.currentSrc,
      error: audio.error ? audio.error.code : null,
      ariaLabel: button ? button.getAttribute("aria-label") : null,
      spinPlayState: spin ? getComputedStyle(spin).animationPlayState : null,
    };
  });
}

async function scenarioOpenParam(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE + "?open=1", { waitUntil: "load" });
  await page.waitForTimeout(2500); // reveal fallback timer

  const initial = await audioState(page);

  // The very first click anywhere must make the music audible.
  await page.getByText("Sự hiện diện của quý khách").first().click();
  await page.waitForTimeout(1500);
  const afterFirstClick = await audioState(page);

  // CD button: pause...
  await page.locator('button[aria-label="Tạm dừng nhạc"]').click();
  await page.waitForTimeout(300);
  const afterPause = await audioState(page);

  // ...and resume.
  await page.locator('button[aria-label="Phát nhạc"]').click();
  await page.waitForTimeout(1500);
  const afterResume = await audioState(page);

  await page.screenshot({ path: `${OUT_DIR}/green-music.png` });
  await page.close();

  return { initial, afterFirstClick, afterPause, afterResume };
}

async function scenarioEnvelope(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForTimeout(2500);

  const initial = await audioState(page);

  // Click the envelope cover open: audible within the same gesture.
  const cover = page.locator('[data-landing-screenshot-id="invite-envelope"]');
  await cover.click();
  await page.waitForTimeout(400);
  const duringOpening = await audioState(page);
  await page.waitForTimeout(2100); // cover teardown
  const afterOpen = await audioState(page);
  await page.screenshot({ path: `${OUT_DIR}/green-music-envelope.png` });
  await page.close();

  return { initial, duringOpening, afterOpen };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--window-size=1280,900"],
  });

  const a = await scenarioOpenParam(browser);
  const b = await scenarioEnvelope(browser);
  await browser.close();

  const passed =
    // A: rolling muted from load, audible at the first click, toggle works
    a.initial.muted === true &&
    a.initial.ariaLabel === "Phát nhạc" &&
    a.initial.spinPlayState === "paused" &&
    a.afterFirstClick.muted === false &&
    a.afterFirstClick.paused === false &&
    a.afterFirstClick.currentTime > 0 &&
    a.afterFirstClick.error === null &&
    a.afterFirstClick.ariaLabel === "Tạm dừng nhạc" &&
    a.afterFirstClick.spinPlayState === "running" &&
    a.afterPause.paused === true &&
    a.afterPause.ariaLabel === "Phát nhạc" &&
    a.afterPause.spinPlayState === "paused" &&
    a.afterResume.paused === false &&
    a.afterResume.currentTime > a.afterPause.currentTime &&
    // B: muted behind the cover, audible the moment it opens
    b.initial.muted === true &&
    b.duringOpening.muted === false &&
    b.duringOpening.paused === false &&
    b.duringOpening.currentTime > 0 &&
    b.afterOpen.paused === false &&
    b.afterOpen.currentTime > b.duringOpening.currentTime;

  console.log(JSON.stringify({ passed, scenarioA: a, scenarioB: b }, null, 2));
  process.exit(passed ? 0 : 1);
})();
