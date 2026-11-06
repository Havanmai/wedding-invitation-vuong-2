# Fix: "Hộp Quà Mừng" click không mở popup

## Root cause

Bản save tĩnh của chungdoi.com (Next.js) không có React hydration — webpack
runtime bị comment out trong `vuong.html` (đã ghi nhận sẵn trong comment của
`envelope.js`). Nút hộp quà (`vuong.html:3210`,
`aria-label="Mở hộp mừng cưới"`) nhận handler click từ React trên trang gốc,
nên trong bản save nó chỉ còn markup tĩnh; `<dialog class="modal">` chứa
"Hộp Quà Mừng" (`vuong.html:3565`) không bao giờ được gọi `showModal()`.

Album và phong bì đã có controller standalone riêng (`album.js`,
`envelope.js`) — hộp quà là widget duy nhất còn thiếu.

## Evidence (RED)

`node artifacts/debug-fe/verify-giftbox.js red` (headless Edge, click chuột
thật vào nút):

- `dialog.modal-bottom.open === false` sau khi click — bug reproduced.
- Screenshot: `artifacts/debug-fe/red-giftbox.png`.
- Console có sẵn lỗi `fbq is not defined` (Facebook pixel của bản save, không
  liên quan).

## Fix

Thêm `giftbox.js` (cùng pattern IIFE với `album.js` / `envelope.js`) và nạp
sau `envelope.js` trong `vuong.html`:

1. Click nút `[aria-label="Mở hộp mừng cưới"]` → `modal.showModal()`
   (guard `if (!modal.open)` tránh InvalidStateError khi double-click).
2. Nút X (`button.btn-circle` trong dialog) → `modal.close()`.
3. Backdrop click + Escape: đóng native qua `<form method="dialog">` có sẵn,
   không cần wire.
4. Dialog được tìm qua `openButton.parentElement.querySelector("dialog")` —
   scope chặt, không đụng lightbox dialog của album.

Không đổi gì trong markup của widget; CSS hover/keyframes `igb-*` còn nguyên
nên hiệu ứng hover vẫn hoạt động.

## Known limitations (ngoài scope báo lỗi)

- Nút "Lưu QR" trong popup chưa có hành vi (trang gốc xử lý bằng React).
- QR chú rể đang bị comment out (`vuong.html:3624`), QR cô dâu trỏ tới
  `chungdoi.com/api/qr-png` — sẽ không hiện khi offline. Cần file QR local
  nếu muốn hiện đầy đủ.

## Verification (GREEN)

`node artifacts/debug-fe/verify-giftbox.js green`: click → dialog mở, heading
"Hộp Quà Mừng" hiển thị → click X → dialog đóng; không có console error mới.
Screenshot: `artifacts/debug-fe/green-giftbox.png`,
`green-giftbox-after-close.png`.
