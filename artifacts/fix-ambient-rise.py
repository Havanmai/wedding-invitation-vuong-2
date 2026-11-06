"""Repair the truncated `@keyframes ambient-rise` in vuong.html.

The envelope's ambient decorations (the drifting 囍 characters) each run
`animation: ambient-rise ...`. The keyframes block was cut short after its
`0%` rule, so the animation fell back to interpolating towards the
element's own base values (opacity 1, transform none) instead of rising off
the bottom of the screen:

  * opacity animated 0 -> 1 (the block's max is .55)
  * transform animated translatey(6vh) -> none (no rotation, no -92vh rise)

The characters therefore never rose: they sat at `bottom: -30px`, below the
viewport, clipped by the overlay's `overflow: hidden` - invisible.

Also fixes the brace-walking helper in apply-envelope-fix.py, whose old
"first `}` after the name" heuristic truncated the last keyframe the same way.
"""
import io
import os
import re
import sys

VUONG = "vuong.html"
THIEP = "thiep.html"

BROKEN = """      @keyframes ambient-rise {
        0% {
          transform: translatey(6vh) translatex(0) rotate(0deg);
          opacity: 0;
        }
    </style>
"""

FULL = """      @keyframes ambient-rise {
        0% {
          transform: translatey(6vh) translatex(0) rotate(0deg);
          opacity: 0;
        }
        12% {
          opacity: 0.45;
        }
        55% {
          transform: translatey(-42vh) translatex(var(--sway, 20px))
            rotate(8deg);
          opacity: 0.55;
        }
        92% {
          opacity: 0.35;
        }
        100% {
          transform: translatey(-92vh) translatex(0) rotate(0deg);
          opacity: 0;
        }
      }
    </style>
"""

STOP_RE = re.compile(r"^\s*(\d+(?:\.\d+)?%|from|to)\s*\{", re.M)


def keyframe_body(css, name):
    """Return the body of @keyframes <name>, matched by brace depth."""
    match = re.search(r"@keyframes\s+" + re.escape(name) + r"\s*\{", css)
    if not match:
        return None
    depth = 0
    for index in range(match.end() - 1, len(css)):
        if css[index] == "{":
            depth += 1
        elif css[index] == "}":
            depth -= 1
            if depth == 0:
                return css[match.end() : index]
    return None


def audit(css, label):
    """Report the real keyframe stops of every envelope animation."""
    print("%s:" % label)
    for name in (
        "envelope-away",
        "particle-burst",
        "seal-pulse",
        "seal-break",
        "seal-ring",
        "seal-flower-bloom",
        "shine",
        "dragon-fly-forward",
        "ambient-fall",
        "ambient-rise",
    ):
        body = keyframe_body(css, name)
        if body is None:
            print("  %-22s MISSING / UNCLOSED" % name)
            continue
        stops = STOP_RE.findall(body)
        flag = "" if len(stops) >= 3 else "   <-- TRUNCATED"
        print("  %-22s %s%s" % (name, ", ".join(stops), flag))


def main():
    with io.open(VUONG, "r", encoding="utf-8", newline="") as handle:
        text = handle.read()

    audit(text, "before")

    if BROKEN in text:
        text = text.replace(BROKEN, FULL, 1)
        action = "replaced the truncated block"
    elif FULL in text:
        action = "already complete"
    else:
        sys.exit("FATAL: could not locate the ambient-rise block")

    tmp = VUONG + ".tmp"
    with io.open(tmp, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)
    os.replace(tmp, VUONG)

    print("\n%s" % action)
    audit(text, "after")

    # Keep the extractor in apply-envelope-fix.py honest for future runs.
    fixer = "artifacts/apply-envelope-fix.py"
    if os.path.exists(fixer):
        with io.open(fixer, "r", encoding="utf-8", newline="") as handle:
            src = handle.read()
        broken_helper = """    end = next(
        i for i in range(start, len(lines)) if lines[i].strip() == "}" and "ambient-rise" in "\\n".join(lines[start:i])
    )
    return lines[start : end + 1]"""
        fixed_helper = """    depth = 0
    end = None
    for i in range(start, len(lines)):
        depth += lines[i].count("{") - lines[i].count("}")
        if depth == 0:
            end = i
            break
    if end is None:
        raise SystemExit("FATAL: could not find the end of the keyframes block")
    return lines[start : end + 1]"""
        if broken_helper in src:
            src = src.replace(broken_helper, fixed_helper, 1)
            with io.open(fixer, "w", encoding="utf-8", newline="") as handle:
                handle.write(src)
            print("\npatched %s: brace-matched keyframes extraction" % fixer)


if __name__ == "__main__":
    main()
