/* Standalone controller for the saved "Hộp Quà Mừng" gift-box widget.
 *
 * The original chungdoi.com page attached React handlers to the gift box:
 * clicking it called showModal() on the sibling <dialog class="modal"> that
 * holds the two bank-QR cards. The saved copy has no React at all (the
 * webpack runtime that boots it is commented out in vuong.html), so the
 * button renders with its hover animations but nothing answers the click.
 *
 * This script restores the behaviour on the saved DOM: click opens the QR
 * popup, and the X button closes it. The backdrop click and the Escape key
 * already close it natively through the <form method="dialog"> inside the
 * dialog, so they need no wiring here.
 */
(function () {
  "use strict";

  var OPEN_BUTTON_SELECTOR = 'button[aria-label="Mở hộp mừng cưới"]';

  var openButton = document.querySelector(OPEN_BUTTON_SELECTOR);
  if (!openButton) return;

  // The dialog is the button's only element sibling inside the section, so
  // scoping the query to the parent cannot pick up the album lightbox dialog.
  var modal = openButton.parentElement.querySelector("dialog");
  if (!modal) return;

  openButton.addEventListener("click", function () {
    if (!modal.open) modal.showModal();
  });

  var closeButton = modal.querySelector("button.btn-circle");
  if (closeButton) {
    closeButton.addEventListener("click", function () {
      modal.close();
    });
  }
})();
