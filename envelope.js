/* Standalone controller for the saved invite-envelope cover.
 *
 * The original chungdoi.com page rendered this cover server-side and let
 * React open it: the "Mở thiệp" link navigated to ?open=1, the RSC payload
 * came back with initialEnvelopeOpen: true, and the overlay unmounted.
 *
 * The local copy has no React at all - the webpack runtime that boots it is
 * commented out in vuong.html - so ?open=1 can only reload the same file
 * with the cover still on top. This script restores the behaviour on the
 * saved DOM: the seal breaks, particles burst, the card flies away, and the
 * invitation underneath is revealed. The open is announced on the
 * "envelope:opened" event so music.js can start the background music inside
 * the same user gesture.
 *
 * Two-screen setup for the local copy:
 *   screen 1  /vuong.html        - the envelope cover
 *   screen 2  /vuong.html?open=1 - cover skipped (one-shot entry state; the
 *              address bar is cleaned so any reload lands back on screen 1)
 *
 * ?open=1 skips the cover entirely, matching the server-rendered variant.
 */
(function () {
  "use strict";

  var OVERLAY_SELECTOR = '[data-landing-screenshot-id="invite-envelope"]';
  var PARTICLE_COUNT = 18;
  var PARTICLE_COLORS = [
    "#e8f0e4",
    "#f0d9a0",
    "#d4af37",
    "#a8e6a3",
    "#fff4d6",
  ];

  var SEAL_BREAK_MS = 550;
  var CARD_FLY_DELAY_MS = 200;
  var CARD_FLY_MS = 1000;
  var BACKDROP_FADE_DELAY_MS = 400;
  var BACKDROP_FADE_MS = 600;
  var TEARDOWN_MS = 1300;

  var overlay = document.querySelector(OVERLAY_SELECTOR);
  if (!overlay) return;

  var wrapper = overlay.parentElement;
  var seal = overlay.querySelector('[style*="seal-pulse"]');
  var sealGlyph = seal ? seal.querySelector("div") : null;
  var cardGroup = overlay.querySelector('div[style="z-index: 10"]');
  var openLink = overlay.querySelector('a[href*="open=1"]');

  var scrollLocked = false;
  var savedPaddingRight = "";
  var opening = false;

  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function lockScroll() {
    if (scrollLocked) return;
    scrollLocked = true;
    savedPaddingRight = document.body.style.paddingRight;
    var gap = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = gap + "px";
  }

  function unlockScroll() {
    if (!scrollLocked) return;
    scrollLocked = false;
    document.documentElement.style.overflow = "";
    document.body.style.paddingRight = savedPaddingRight;
  }

  // The seal sits above the card, so the burst has to render above both.
  function spawnBurst(x, y) {
    var host = document.createElement("div");
    host.style.cssText =
      "position:absolute;left:0;top:0;width:0;height:0;z-index:40;pointer-events:none;";

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var angle = (Math.PI * 2 * i) / PARTICLE_COUNT + Math.random() * 0.5;
      var distance = 70 + Math.random() * 110;
      var size = 5 + Math.random() * 7;
      var tall = Math.random() < 0.4 ? 2.2 : 1;
      var particle = document.createElement("span");

      particle.style.cssText = [
        "position:absolute",
        "left:" + x + "px",
        "top:" + y + "px",
        "width:" + size.toFixed(1) + "px",
        "height:" + (size * tall).toFixed(1) + "px",
        "border-radius:2px",
        "background:" + PARTICLE_COLORS[i % PARTICLE_COLORS.length],
        "opacity:0",
        // particle-burst centres the element with translate(-50%, -50%) and
        // offsets it by --dx/--dy, so left/top stay at the burst origin.
        "animation:particle-burst 1.1s cubic-bezier(0.2,0.7,0.3,1) " +
          i * 12 +
          "ms forwards",
        "--dx:" + (Math.cos(angle) * distance).toFixed(1) + "px",
        "--dy:" + (Math.sin(angle) * distance).toFixed(1) + "px",
        "--rot-start:" + Math.round(Math.random() * 90 - 45) + "deg",
        "--rot-end:" + Math.round(Math.random() * 720 - 360) + "deg",
      ].join(";") + ";";

      host.appendChild(particle);
    }

    overlay.appendChild(host);
    window.setTimeout(function () {
      host.remove();
    }, PARTICLE_COUNT * 12 + 1400);
  }

  function spawnRing(x, y) {
    var ring = document.createElement("span");
    ring.style.cssText = [
      "position:absolute",
      "left:" + x + "px",
      "top:" + y + "px",
      "width:56px",
      "height:56px",
      "border-radius:9999px",
      "border:2px solid rgba(232,240,228,0.9)",
      "box-shadow:0 0 24px rgba(232,240,228,0.5)",
      "z-index:41",
      "pointer-events:none",
      "opacity:0",
      "animation:seal-ring 0.9s ease-out forwards",
    ].join(";") + ";";

    overlay.appendChild(ring);
    window.setTimeout(function () {
      ring.remove();
    }, 1000);
  }

  function sealCenter() {
    if (!seal) return null;
    var rect = seal.getBoundingClientRect();
    // The overlay is fixed at inset-0, so viewport coordinates are already
    // relative to it.
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function removeCover() {
    if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    unlockScroll();
  }

  function openCover(event) {
    if (event) event.preventDefault();
    if (opening) return;
    opening = true;

    // Announce the open so other controllers can react within the same user
    // gesture - music.js starts the background music here, and browsers only
    // allow audible playback inside a gesture.
    document.dispatchEvent(new CustomEvent("envelope:opened"));

    if (openLink) {
      openLink.setAttribute("aria-busy", "true");
      openLink.setAttribute("aria-disabled", "true");
    }

    if (prefersReducedMotion()) {
      removeCover();
      return;
    }

    var center = sealCenter();
    if (seal) {
      seal.style.animation = "seal-break 0.55s ease-out forwards";
    }
    if (sealGlyph) {
      sealGlyph.style.animation = "seal-flower-bloom 0.9s ease-out forwards";
    }
    if (center) {
      spawnBurst(center.x, center.y);
      spawnRing(center.x, center.y);
    }

    window.setTimeout(function () {
      if (cardGroup) {
        cardGroup.style.animation =
          "envelope-away 1s cubic-bezier(0.4,0,0.2,1) forwards";
      }
    }, CARD_FLY_DELAY_MS);

    overlay.style.transition =
      "opacity " + BACKDROP_FADE_MS + "ms ease " + BACKDROP_FADE_DELAY_MS + "ms";
    overlay.style.opacity = "0";

    window.setTimeout(removeCover, TEARDOWN_MS);
  }

  function skipCover() {
    removeCover();
    // Screen 2 is a one-shot entry state: clean the address bar so a reload
    // always lands back on screen 1 (/vuong.html with the cover). Done
    // after the cover is gone - this is cosmetic, not critical.
    if (window.history && window.history.replaceState) {
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch (e) {
        /* file:// quirks in some browsers - harmless to skip */
      }
    }
  }

  // ?open=1 is the server-rendered "already opened" state.
  var params = new URLSearchParams(window.location.search);
  if (params.get("open") === "1") {
    skipCover();
    return;
  }

  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Thiệp mời");

  // Any click on the cover opens it; the button is handled separately so its
  // href never triggers a reload.
  overlay.addEventListener("click", function (event) {
    if (openLink && openLink.contains(event.target)) return;
    openCover();
  });

  if (openLink) {
    openLink.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      // The URL stays /vuong.html so a reload always lands on screen 1.
      openCover();
    });
  }

  lockScroll();
  if (openLink) openLink.focus();
})();
