// Verify the two envelope images load when vuong.html is opened directly
// from disk (file://) — the scenario where absolute src paths break.
//
//   node verify-envelope-images.js
//
// Exit code 0 = both images decoded (naturalWidth > 0).
const { chromium } = require("playwright-core");

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const FILE_URL = "file:///D:/Learn/Vuong/vuong.html";

(async () => {
  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--window-size=1280,900"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(FILE_URL, { waitUntil: "load" });

  const images = await page.evaluate(() =>
    ["images/themes/envelope.webp", "images/themes/envelope-cut.webp"].map(
      (src) => {
        const img = document.querySelector(`img[src="${src}"]`);
        if (!img) return { src, found: false, loaded: false };
        return {
          src,
          found: true,
          loaded: img.complete && img.naturalWidth > 0,
          naturalWidth: img.naturalWidth,
        };
      }
    )
  );

  await page.screenshot({
    path: "D:/Learn/Vuong/artifacts/debug-fe/envelope-images-file.png",
  });

  const passed = images.every((img) => img.found && img.loaded);
  console.log(JSON.stringify({ passed, images }, null, 2));
  await browser.close();
  process.exit(passed ? 0 : 1);
})();
