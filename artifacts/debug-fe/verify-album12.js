// Verify the 12-photo album: carousel slides, dots, lightbox thumbnails.
//
//   node verify-album12.js
//
// reducedMotion is forced so album autoplay stays off and navigation
// assertions are deterministic. Exit 0 = all assertions passed.
const { chromium } = require("playwright-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUT_DIR = "D:/Learn/Vuong/artifacts/debug-fe";
const URL = "http://127.0.0.1:8123/vuong.html?open=1";

function fileName(src) {
  return decodeURIComponent(src).split("/").pop();
}

(async () => {
  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--window-size=1280,900"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce", // keep album autoplay off
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(2500);

  // -- structure: 12 slides / 12 dots / 12 thumbs, and thumb i must show
  //    the same image as slide i (catches the 8/9 swap class of bug)
  const structure = await page.evaluate(() => {
    const slides = [...document.querySelectorAll("div")].filter(
      (d) =>
        d.className.includes("absolute h-[92%]") &&
        d.querySelector('img[alt^="Wedding photo"]')
    );
    const dots = [...document.querySelectorAll('button[aria-label^="Go to photo"]')];
    const thumbs = [
      ...document.querySelectorAll('button[aria-label^="View image"]'),
    ];
    const thumbAlts = thumbs.map((t) => t.querySelector("img").alt);
    return {
      slides: slides.length,
      dots: dots.length,
      thumbs: thumbs.length,
      thumbAlts,
    };
  });

  // slide-to-thumb image pairing
  const pairing = await page.evaluate(() => {
    const slides = [...document.querySelectorAll("div")].filter(
      (d) =>
        d.className.includes("absolute h-[92%]") &&
        d.querySelector('img[alt^="Wedding photo"]')
    );
    const thumbs = [
      ...document.querySelectorAll('button[aria-label^="View image"]'),
    ];
    return slides.map((s, i) => {
      const a = s.querySelector("img").getAttribute("src");
      const b = thumbs[i].querySelector("img").getAttribute("src");
      return { i: i + 1, match: a === b };
    });
  });
  const pairOk = pairing.every((p) => p.match);

  // -- dot navigation is 1:1 with slides
  await page.locator('button[aria-label="Go to photo 12"]').click();
  await page.waitForTimeout(1300);
  const centerAfter12 = await page.evaluate(() => {
    const slides = [...document.querySelectorAll("div")].filter(
      (d) =>
        d.className.includes("absolute h-[92%]") &&
        d.querySelector('img[alt^="Wedding photo"]')
    );
    const center = slides.find((s) => s.style.transform.includes("translateX(0%)"));
    return center ? center.querySelector("img").alt : null;
  });
  await page.screenshot({ path: `${OUT_DIR}/green-album-photo12.png` });

  // -- lightbox: open via center slide (dot 4 first), check counter
  await page.locator('button[aria-label="Go to photo 4"]').click();
  await page.waitForTimeout(1300);
  const center = await page.evaluate(() => {
    const slides = [...document.querySelectorAll("div")].filter(
      (d) =>
        d.className.includes("absolute h-[92%]") &&
        d.querySelector('img[alt^="Wedding photo"]')
    );
    const c = slides.find((s) => s.style.transform.includes("translateX(0%)"));
    const r = c.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.click(center.x, center.y);
  await page.waitForTimeout(500);
  const lightboxOnOpen = await page.evaluate(() => {
    const dlg = document.querySelector("dialog.modal");
    const big = dlg.querySelector('img[alt^="Ảnh cưới"]');
    const counter = [...dlg.querySelectorAll("div")].find((d) =>
      /^\d+ \/ \d+$/.test(d.textContent.trim())
    );
    return {
      open: dlg.open,
      counter: counter ? counter.textContent.trim() : null,
      bigFile: big
        ? decodeURIComponent(big.src).split("/").pop().slice(0, 26)
        : null,
    };
  });

  // -- click thumb 8: big image, counter and active thumb must all follow
  await page.locator('button[aria-label="View image 8"]').click();
  await page.waitForTimeout(400);
  const lightboxThumb8 = await page.evaluate(() => {
    const dlg = document.querySelector("dialog.modal");
    const big = dlg.querySelector('img[alt^="Ảnh cưới"]');
    const counter = [...dlg.querySelectorAll("div")].find((d) =>
      /^\d+ \/ \d+$/.test(d.textContent.trim())
    );
    const active = dlg.querySelector('button[aria-current="true"]');
    return {
      counter: counter ? counter.textContent.trim() : null,
      bigFile: big
        ? decodeURIComponent(big.src).split("/").pop().slice(0, 26)
        : null,
      activeThumb: active ? active.getAttribute("aria-label") : null,
    };
  });
  await page.screenshot({ path: `${OUT_DIR}/green-album-lightbox8.png` });

  await browser.close();

  const passed =
    structure.slides === 12 &&
    structure.dots === 12 &&
    structure.thumbs === 12 &&
    structure.thumbAlts.join(",") ===
      Array.from({ length: 12 }, (_, i) => `Thumbnail ${i + 1}`).join(",") &&
    pairOk &&
    centerAfter12 === "Wedding photo 12" &&
    lightboxOnOpen.open === true &&
    lightboxOnOpen.counter === "4 / 12" &&
    lightboxThumb8.counter === "8 / 12" &&
    lightboxThumb8.activeThumb === "View image 8" &&
    lightboxThumb8.bigFile !== null &&
    lightboxThumb8.bigFile === fileName(
      "file:///D:/Learn/Vuong/assets/images/1wupukthakqxron2jsh9ygocokyk7tqr1lw8v1rr7y3nyduxq9xnnna8lpynlml9xda8.jpg"
    ).slice(0, 26) &&
    // "fbq is not defined" is the saved page's own missing Facebook pixel -
    // pre-existing noise, anything else is a real regression.
    pageErrors.filter((e) => !e.includes("fbq")).length === 0;

  console.log(
    JSON.stringify(
      { passed, structure, pairOk, centerAfter12, lightboxOnOpen, lightboxThumb8, pageErrors },
      null,
      2
    )
  );
  process.exit(passed ? 0 : 1);
})();
