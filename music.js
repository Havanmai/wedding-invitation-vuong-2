/* Standalone controller for the background music widget.
 *
 * The original chungdoi.com page started the hidden <audio> through React
 * right after the guest opened the envelope cover, and let the floating CD
 * button pause/resume it (its aria-label flips between the two states). The
 * saved copy has no React at all, so the CD spins silently and the button
 * does nothing.
 *
 * This script restores the behaviour on the saved DOM, as early as browser
 * autoplay policies allow:
 *   - on load the script first asks for audible playback outright - browsers
 *     with a per-site sound allowance give true autoplay; most refuse, and
 *     the script then pre-starts the track MUTED (allowed everywhere), so
 *     playback is rolling behind the envelope cover either way;
 *   - the guest's first interaction of any kind - typically the tap that
 *     opens the envelope - unmutes it inside that gesture, which is what
 *     autoplay policies require for audible sound. envelope.js also
 *     announces the open on "envelope:opened" as an explicit trigger;
 *   - the CD button toggles play/pause, syncing its aria-label and pausing
 *     the spin/dance animations while the music is off.
 */
(function () {
  "use strict";

  var PLAY_LABEL = "Phát nhạc";
  var PAUSE_LABEL = "Tạm dừng nhạc";

  var audio = document.querySelector('audio[data-video-audio="true"]');
  var button = document.querySelector('button[aria-label="' + PAUSE_LABEL + '"]');
  if (!audio || !button) return;

  var animated = Array.prototype.slice.call(
    button.querySelectorAll(
      '[class*="animate-spin-cd"], [class*="animate-dance-"]'
    )
  );

  function setPlayingUI(playing) {
    button.setAttribute("aria-label", playing ? PAUSE_LABEL : PLAY_LABEL);
    animated.forEach(function (el) {
      el.style.animationPlayState = playing ? "running" : "paused";
    });
  }

  // Audible means the guest can actually hear it - the muted pre-start does
  // not count and must not light up the "playing" UI.
  function isAudible() {
    return !audio.muted && !audio.paused;
  }

  audio.addEventListener("play", function () {
    if (isAudible()) setPlayingUI(true);
  });
  audio.addEventListener("pause", function () {
    setPlayingUI(false);
  });
  setPlayingUI(false);

  var audibleOnce = false;
  function makeAudible() {
    if (audibleOnce) return;
    audibleOnce = true;
    audio.muted = false;
    setPlayingUI(true);
    // Usually a no-op: playback is already rolling (audibly or muted).
    // Retried in case the browser refused even the muted pre-start.
    audio.play().catch(function () {
      /* The CD button remains as the manual fallback. */
    });
  }

  // 1) Ask for audible playback straight away. Browsers that allow it
  //    (per-site sound permission, or high media engagement with this
  //    origin) get true autoplay from the very first screen. Most refuse
  //    until the first gesture, so fall back to a muted pre-start, which
  //    every browser permits, and unmute at the first interaction below.
  audio.play().then(function () {
    audibleOnce = true;
    setPlayingUI(true);
  }).catch(function () {
    audio.muted = true;
    audio.play().catch(function () {
      /* makeAudible() retries inside the guest's first gesture. */
    });
  });

  // 2) First interaction of any kind unmutes the muted pre-start. Bubble
  //    phase on purpose: if the first press lands on the CD button itself,
  //    the button's own pointerdown must record the not-yet-audible state
  //    first (see below). "wheel" covers desktop scrolling, which fires no
  //    pointer events.
  ["pointerdown", "keydown", "touchend", "wheel"].forEach(function (type) {
    document.addEventListener(type, makeAudible, { once: true });
  });

  // envelope.js announces the cover open inside the guest's click gesture.
  document.addEventListener("envelope:opened", makeAudible);

  // Was the sound on when the current press began? Distinguishes "this
  // click turns the sound on" from "this click pauses it" - required
  // because the first press may already have unmuted the track via the
  // document-level listener above.
  var soundOnAtPress = false;
  button.addEventListener("pointerdown", function () {
    soundOnAtPress = isAudible();
  });

  button.addEventListener("click", function () {
    if (soundOnAtPress) {
      audio.pause(); // sound was on when pressed - this click turns it off
      return;
    }
    // Sound was off (muted pre-start, or paused earlier) - turn it on.
    audio.muted = false;
    audio.play().catch(function () {
      /* The CD button remains as the manual fallback. */
    });
    setPlayingUI(true);
  });
})();
