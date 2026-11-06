"""Rebalance the invite-envelope photo cluster in vuong.html.

The cluster is the envelope artwork with two framed photos tucked into it:

    <div class="relative z-10 mt-4 aspect-[268/317] w-[77%] max-w-[326px] ...">
      <img ... envelope.webp>            (back of the envelope,  z-10)
      <div class="absolute left-[72%] top-[3%]  z-20 w-[56%]">  (groom photo)
      <div class="absolute left-[31.7%] top-[20%] z-20 w-[56%]"> (bride photo)
      <img ... envelope-cut.webp>         (open flap,           z-30)
    </div>

Problems with the saved values:

1. The container had no `mx-auto`, so the envelope sat flush against the left
   edge of the section while its photos spilled out to the right - the whole
   composition read as lopsided. Centre the container.
2. The photos were at left 72% / 31.7% with width 56%. The groom's photo ran
   to 128% of the container and hung completely outside the envelope, with the
   bride's photo sitting on top of it. Lay the two out as mirror images about
   the container's centre (48+50 = 4+50+... -> bride [4%,54%], groom
   [48%,98%]), so each one tucks behind the matching flap edge.
3. `mgFloatG` / `mgFloatB` were referenced by the photos' inline animation but
   never defined, so neither photo floated. Add the keyframes.

Idempotent: re-running is a no-op.
"""
import io
import os
import re
import sys

VUONG = "vuong.html"

OLD_CONTAINER = (
    'class="relative z-10 mt-4 aspect-[268/317] w-[77%] max-w-[326px] '
    'md:mt-6 md:max-w-[425px]"'
)
NEW_CONTAINER = (
    'class="relative z-10 mx-auto mt-4 aspect-[268/317] w-[82%] max-w-[340px] '
    'md:mt-6 md:max-w-[440px]"'
)

# Groom photo is the first .photo block (Đinh Vượng), bride the second.
PHOTO_CLASSES = (
    ("absolute left-[48%] top-[3%] z-20 w-[50%]", "groom"),
    ("absolute left-[4%] top-[19%] z-20 w-[50%]", "bride"),
)

FLOAT_KEYFRAMES = """      @keyframes mgFloatG {
        0%,
        100% {
          transform: translateY(0) rotate(0deg);
        }
        50% {
          transform: translateY(-8px) rotate(-1.2deg);
        }
      }
      @keyframes mgFloatB {
        0%,
        100% {
          transform: translateY(0) rotate(0deg);
        }
        50% {
          transform: translateY(-6px) rotate(1.2deg);
        }
      }
"""

FLOAT_ANCHOR = "      @keyframes spin-cd {\n"

PHOTO_RE = re.compile(
    r'class="absolute left-\[[0-9.]+%\] top-\[[0-9.]+%\] z-20 w-\[[0-9]+%\]"'
)


def main():
    with io.open(VUONG, "r", encoding="utf-8", newline="") as handle:
        text = handle.read()

    changes = []

    # 1. Centre the container.
    if OLD_CONTAINER in text:
        text = text.replace(OLD_CONTAINER, NEW_CONTAINER, 1)
        changes.append("container")
    elif NEW_CONTAINER in text:
        changes.append("container (already applied)")
    else:
        sys.exit("FATAL: container class not found")

    # 2. Re-place the two photos, in document order: groom first, bride second.
    found = PHOTO_RE.findall(text)
    if len(found) != 2:
        sys.exit("FATAL: expected 2 photo blocks, found %d" % len(found))
    for old, (new_classes, label) in zip(found, PHOTO_CLASSES):
        if old not in text:
            sys.exit("FATAL: photo class %r not found verbatim" % old)
        new = 'class="%s"' % new_classes
        text = text.replace(old, new, 1)
        if new not in text:
            sys.exit("FATAL: replacement for %s did not land" % label)
        changes.append("%s photo %s -> %s" % (label, old, new_classes))

    # 3. Define the float keyframes the photos already reference.
    if "@keyframes mgFloatG" not in text:
        if FLOAT_ANCHOR not in text:
            sys.exit("FATAL: spin-cd anchor not found")
        text = text.replace(FLOAT_ANCHOR, FLOAT_KEYFRAMES + FLOAT_ANCHOR, 1)
        changes.append("mgFloatG / mgFloatB keyframes")

    tmp = VUONG + ".tmp"
    with io.open(tmp, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)
    os.replace(tmp, VUONG)

    print("applied:")
    for line in changes:
        print("  -", line)


if __name__ == "__main__":
    main()
