"""Apply the invite-envelope fix to vuong.html in one atomic pass.

Idempotent: re-running on an already-fixed file is a no-op. Prints a summary
of what it changed so the caller can confirm the result on disk.
"""
import hashlib
import io
import os
import sys

VUONG = "vuong.html"
THIEP = "thiep.html"

# The seal's original mask (themes/songlong-red/chinese_happiness.webp) is not
# part of the local asset set; chu-hy.webp is the same 囍 glyph.
OLD_MASK = "/images/themes/songlong-red/chinese_happiness.webp"
NEW_MASK = "images/themes/song-hy-red/chu-hy.webp"
OLD_CARD_IMG = "/images/themes/song-hy-red/chu-hy.webp"
NEW_CARD_IMG = "images/themes/song-hy-red/chu-hy.webp"

changes = []


def read(path):
    with io.open(path, "r", encoding="utf-8", newline="") as handle:
        return handle.read()


def write(path, text):
    tmp = path + ".tmp"
    with io.open(tmp, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)
    os.replace(tmp, path)


def envelope_keyframes():
    """Pull the envelope @keyframes block out of thiep.html."""
    lines = read(THIEP).split("\n")
    start = next(
        i for i, l in enumerate(lines) if l.strip() == "@keyframes envelope-away {"
    )
    depth = 0
    end = None
    for i in range(start, len(lines)):
        depth += lines[i].count("{") - lines[i].count("}")
        if depth == 0:
            end = i
            break
    if end is None:
        raise SystemExit("FATAL: could not find the end of the keyframes block")
    return lines[start : end + 1]


def main():
    text = read(VUONG)
    before_md5 = hashlib.md5(text.encode("utf-8")).hexdigest()

    # 1. Envelope @keyframes -> their own styled-jsx block, as in thiep.html.
    if "@keyframes envelope-away" not in text:
        lines = text.split("\n")
        idx = next(
            i
            for i, l in enumerate(lines)
            if l.strip() == '<style type="text/css" data-styled-jsx="">'
            and i + 1 < len(lines)
            and "fade-in" in lines[i + 1]
        )
        block = ['    <style type="text/css" data-styled-jsx="">'] + envelope_keyframes() + ["    </style>"]
        lines[idx:idx] = block
        text = "\n".join(lines)
        changes.append("inserted %d envelope @keyframes" % (len(block) - 2))
    else:
        changes.append("envelope @keyframes already present")

    # 2. Un-comment the envelope overlay.
    opener = '<!-- <div dir="ltr" lang="vi" style="display: contents">'
    if opener in text:
        text = text.replace(opener, '<div dir="ltr" lang="vi" style="display: contents">', 1)
        changes.append("un-commented envelope opener")
    closer = "</div> -->"
    if closer in text:
        text = text.replace(closer, "</div>", 1)
        changes.append("un-commented envelope closer")

    # 3. Point the seal mask and the card artwork at assets that exist locally.
    if OLD_MASK in text:
        text = text.replace(OLD_MASK, NEW_MASK)
        changes.append("seal mask -> %s" % NEW_MASK)
    if OLD_CARD_IMG in text:
        text = text.replace(OLD_CARD_IMG, NEW_CARD_IMG)
        changes.append("card artwork -> %s" % NEW_CARD_IMG)

    # 4. Load the standalone envelope controller.
    if 'src="envelope.js"' not in text:
        anchor = '    <script src="album.js"></script>\n'
        if anchor not in text:
            sys.exit("FATAL: album.js script tag not found")
        text = text.replace(anchor, anchor + '    <script src="envelope.js"></script>\n', 1)
        changes.append("added <script src=envelope.js>")

    write(VUONG, text)

    after = read(VUONG)
    print("before md5:", before_md5)
    print("after  md5:", hashlib.md5(after.encode("utf-8")).hexdigest())
    print("bytes:", len(after.encode("utf-8")), "lines:", after.count("\n"))
    for line in changes:
        print("  -", line)


if __name__ == "__main__":
    main()
