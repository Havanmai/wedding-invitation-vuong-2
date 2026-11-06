/* Standalone controller for the saved coverflow album + lightbox.
 *
 * The original chungdoi.com page rendered this widget client-side, so the
 * saved page's RSC payload contains no interactivity for it — React hydration
 * never attaches handlers to this subtree. This script restores the behaviour
 * directly on the saved DOM: prev/next arrows, dots, swipe/drag, click to
 * focus, autoplay, and the fullscreen lightbox.
 */
(function () {
  "use strict";

  var SWIPE_THRESHOLD = 40;
  var AUTOPLAY_INTERVAL = 4500;

  var POSITIONS = {
    "-3": {
      transform: "translateX(-180%) translateZ(-450px) rotateY(-135deg) scale(0.7)",
      opacity: "0.3",
      zIndex: "97",
    },
    "-2": {
      transform: "translateX(-120%) translateZ(-300px) rotateY(-90deg) scale(0.7)",
      opacity: "0.5",
      zIndex: "98",
    },
    "-1": {
      transform: "translateX(-60%) translateZ(-150px) rotateY(-45deg) scale(0.85)",
      opacity: "0.75",
      zIndex: "99",
    },
    0: {
      transform: "translateX(0%) translateZ(0px) rotateY(0deg) scale(1)",
      opacity: "1",
      zIndex: "100",
    },
    1: {
      transform: "translateX(60%) translateZ(-150px) rotateY(45deg) scale(0.85)",
      opacity: "0.75",
      zIndex: "99",
    },
    2: {
      transform: "translateX(120%) translateZ(-300px) rotateY(90deg) scale(0.7)",
      opacity: "0.5",
      zIndex: "98",
    },
    3: {
      transform: "translateX(180%) translateZ(-450px) rotateY(135deg) scale(0.7)",
      opacity: "0.3",
      zIndex: "97",
    },
  };

  var nextBtn = document.querySelector('button[aria-label="Next photo"]');
  var prevBtn = document.querySelector('button[aria-label="Previous photo"]');
  if (!nextBtn || !prevBtn) return;

  var stage = nextBtn.parentElement;
  var carousel = stage.querySelector('[style*="perspective"]');
  var slides = Array.prototype.slice.call(carousel.children);
  var count = slides.length;
  if (!count) return;

  var dots = Array.prototype.slice.call(
    document.querySelectorAll('button[aria-label^="Go to photo"]')
  );

  function offsetOf(slide) {
    var match = slide.style.transform.match(/translateX\((-?[\d.]+)%\)/);
    return match ? Math.round(parseFloat(match[1]) / 60) : null;
  }

  // Offsets beyond the 3 visible side slots (12 photos need them) extrapolate
  // the same cylinder further out and stay invisible until they rotate back
  // into range - without this they would all pile up on the +/-3 positions.
  function positionFor(offset) {
    var known = POSITIONS[offset];
    if (known) return known;
    return {
      transform:
        "translateX(" +
        offset * 60 +
        "%) translateZ(" +
        offset * -150 +
        "px) rotateY(" +
        offset * 45 +
        "deg) scale(0.7)",
      opacity: "0",
      zIndex: String(Math.max(90, 97 - Math.abs(offset))),
    };
  }

  var current = Math.max(
    0,
    slides.findIndex(function (slide) {
      return offsetOf(slide) === 0;
    })
  );

  function render() {
    slides.forEach(function (slide, i) {
      var offset = i - current;
      if (offset > count / 2) offset -= count;
      if (offset < -count / 2) offset += count;
      var pos = positionFor(offset);
      slide.style.transform = pos.transform;
      slide.style.opacity = pos.opacity;
      slide.style.zIndex = pos.zIndex;
      slide.classList.toggle("ring-2", offset === 0);
      slide.classList.toggle("ring-white/30", offset === 0);
    });
    dots.forEach(function (dot, i) {
      var active = i === current;
      dot.classList.toggle("w-6", active);
      dot.classList.toggle("w-2", !active);
      dot.classList.toggle("opacity-70", active);
      dot.classList.toggle("opacity-25", !active);
    });
  }

  function goTo(index) {
    current = (index + count) % count;
    render();
  }

  function next() {
    goTo(current + 1);
  }

  function prev() {
    goTo(current - 1);
  }

  nextBtn.addEventListener("click", next);
  prevBtn.addEventListener("click", prev);
  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function () {
      goTo(i);
    });
  });

  // Swipe / drag (touch-pan-y container: vertical scroll stays native)
  var dragStartX = null;
  stage.addEventListener("pointerdown", function (e) {
    dragStartX = e.clientX;
  });
  stage.addEventListener("pointerup", function (e) {
    if (dragStartX === null) return;
    var dx = e.clientX - dragStartX;
    dragStartX = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx < 0) next();
      else prev();
    }
  });
  stage.addEventListener("pointercancel", function () {
    dragStartX = null;
  });

  // Lightbox (fullscreen <dialog> with its own arrows, counter, thumbnails)
  var lightbox = document.querySelector("dialog.modal");

  function renderLightbox() {
    if (!lightbox) return;
    var thumbs = Array.prototype.slice.call(
      lightbox.querySelectorAll('button[aria-label^="View image"]')
    );
    var bigImg = lightbox.querySelector('img[alt^="Ảnh cưới"]');
    var counter = lightbox.querySelector("div.bg-black\\/40");
    if (bigImg && thumbs[current]) bigImg.src = thumbs[current].querySelector("img").src;
    if (counter) counter.textContent = current + 1 + " / " + count;
    thumbs.forEach(function (thumb, i) {
      var active = i === current;
      thumb.setAttribute("aria-current", active ? "true" : "false");
      thumb.style.outline = active ? "rgb(31, 58, 37) solid 2px" : "none";
      thumb.style.outlineOffset = active ? "2px" : "";
      thumb.classList.toggle("scale-105", active);
      thumb.classList.toggle("shadow-lg", active);
      thumb.classList.toggle("opacity-60", !active);
      thumb.classList.toggle("hover:opacity-100", !active);
    });
  }

  function openLightbox() {
    if (!lightbox) return;
    renderLightbox();
    lightbox.showModal();
  }

  if (lightbox) {
    var lbPrev = lightbox.querySelector('button[aria-label="Previous image"]');
    var lbNext = lightbox.querySelector('button[aria-label="Next image"]');
    var thumbs = Array.prototype.slice.call(
      lightbox.querySelectorAll('button[aria-label^="View image"]')
    );
    if (lbPrev) lbPrev.addEventListener("click", function () { prev(); renderLightbox(); });
    if (lbNext) lbNext.addEventListener("click", function () { next(); renderLightbox(); });
    thumbs.forEach(function (thumb, i) {
      thumb.addEventListener("click", function () {
        goTo(i);
        renderLightbox();
      });
    });
  }

  // Click a slide: side slide -> bring to center; center slide -> lightbox
  slides.forEach(function (slide, i) {
    slide.addEventListener("click", function () {
      if (i === current) openLightbox();
      else goTo(i);
    });
  });

  // Autoplay, paused while the pointer is over the album
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var timer = null;
  function startAutoplay() {
    if (reducedMotion || timer) return;
    timer = setInterval(next, AUTOPLAY_INTERVAL);
  }
  function stopAutoplay() {
    clearInterval(timer);
    timer = null;
  }
  stage.addEventListener("pointerenter", stopAutoplay);
  stage.addEventListener("pointerleave", startAutoplay);

  render();
  try {
    renderLightbox();
  } catch (e) {
    if (window.console && console.warn) console.warn("album lightbox init:", e);
  }
  startAutoplay();
})();
