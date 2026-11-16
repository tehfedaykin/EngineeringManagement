"""Build original pixel-art SVG data URIs for the golden-city theme and splice them into its CSS.

usage: python3 -I pixel_art.py <golden-city.css>
"""
import sys
import urllib.parse
from pathlib import Path

PAL = {
    "K": "#2b1a22",  # outline
    "G": "#3f9b3f", "L": "#7ccf5a", "D": "#2c6e2c",  # leaves
    "B": "#8a5a2b", "b": "#5e3a1a",  # trunk / wood
    "R": "#c8462e", "r": "#8f2c1c",  # red roof
    "U": "#3d6fc4", "u": "#284a8a",  # blue roof
    "W": "#fff2cc", "w": "#e6cf98",  # walls
    "S": "#9fd3f0",  # window glass
    "Y": "#e8e070", "y": "#b8b040",  # mascot body
    "P": "#f2a0a0",  # blush
    "F": "#f05a5a", "f": "#ffffff", "O": "#f8d030",  # flowers
    "T": "#5aa83f", "t": "#3f7f2c",  # grass tufts
}


def svg(rows, scale=2, w=None, h=None, ox=0, oy=0, extra=""):
    width = w or len(rows[0]) * scale
    height = h or len(rows) * scale
    rects = []
    for y, row in enumerate(rows):
        x = 0
        while x < len(row):
            ch = row[x]
            if ch == ".":
                x += 1
                continue
            run = 1
            while x + run < len(row) and row[x + run] == ch:
                run += 1
            rects.append(f"<rect x='{ox + x * scale}' y='{oy + y * scale}' width='{run * scale}' height='{scale}' fill='{PAL[ch]}'/>")
            x += run
    body = "".join(rects)
    return f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' shape-rendering='crispEdges'>{extra}{body}</svg>"


def uri(markup):
    return "url(\"data:image/svg+xml," + urllib.parse.quote(markup, safe="/:=' ") + "\")"


TREE = [
    ".....KKKKKK.....",
    "...KKGGGGGGKK...",
    "..KGGGLLGGGGGK..",
    ".KGGLLLLGGGGGGK.",
    ".KGGLLGGGGGDGGK.",
    "KGGGGGGGGGDDGGGK",
    "KGGGGGGGGGGGGGGK",
    "KGDGGGGGGGGGDGGK",
    "KGDDGGGGGGGDDGGK",
    ".KGGGGGGGGGGGGK.",
    ".KDGGGGDGGGGGDK.",
    "..KKDDGGGGDDKK..",
    "....KKKBBKKK....",
    "......KBbK......",
    "......KBbK......",
    ".....KKKKKK.....",
]


def house(roof, roof_dark):
    rows = [
        "......KKKKKKKKKKKK......",
        "....KKRRRRRRRRRRRRKK....",
        "..KKRRRRRRRRRRRRRRRRKK..",
        ".KRRRRRRRRRRRRRRRRRRRRK.",
        "KRRRRRRRRRRRRRRRRRRRRRRK",
        "KrrrrrrrrrrrrrrrrrrrrrrK",
        "KKKKKKKKKKKKKKKKKKKKKKKK",
        ".KWWWWWWWWWWWWWWWWWWWWK.",
        ".KWKKKKWWWWWWWWWKKKKWWK.",
        ".KWKSSKWWWWWWWWWKSSKWWK.",
        ".KWKSSKWWWWWWWWWKSSKWWK.",
        ".KWKKKKWWWKKKKWWKKKKWWK.",
        ".KWWWWWWWWKbbKWWWWWWWWK.",
        ".KwwwwwwwwKbbKwwwwwwwwK.",
        ".KwwwwwwwwKbBKwwwwwwwwK.",
        ".KwwwwwwwwKbbKwwwwwwwwK.",
        ".KKKKKKKKKKKKKKKKKKKKKK.",
    ]
    return [r.replace("R", roof).replace("r", roof_dark) for r in rows]


# An original mascot: a round sprout creature with a two-leaf top.
MASCOT = [
    "......KK.KK.....",
    ".....KLLKLLK....",
    "......KGKGK.....",
    ".......KGK......",
    ".....KKKKKKK....",
    "...KKYYYYYYYKK..",
    "..KYYYYYYYYYYYK.",
    ".KYYYYYYYYYYYYYK",
    ".KYYKKYYYYYKKYYK",
    ".KYYKKYYYYYKKYYK",
    ".KYPPYYYKYYYPPYK",
    ".KYYYYYYYYYYYYyK",
    "..KYYYYYYYYYYyK.",
    "...KyYYYYYYyyK..",
    "....KKKyyyKKK...",
    "......KKKKK.....",
]

FLOWER_RED = [".F.", "FOF", ".F."]
FLOWER_WHITE = [".f.", "fOf", ".f."]
TUFT = ["T.T.T", "TtTtT"]


GRASS = "#88c070"
GRASS_DARK = "#5f9a4a"
GRASS_LIGHT = "#a8d68a"
DIRT = "#d8b878"
DIRT_EDGE = "#a8844a"
DIRT_PEBBLE = "#bc9a5c"


def rect(x, y, w, h, fill):
    return f"<rect x='{x}' y='{y}' width='{w}' height='{h}' fill='{fill}'/>"


def tile(w, h, body):
    return f"<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}' shape-rendering='crispEdges'>{body}</svg>"


def grass_tile():
    """32x32 grass with a few short blades and sunlit specks."""
    blades = [(4, 6), (20, 3), (12, 18), (27, 22), (6, 27)]
    body = rect(0, 0, 32, 32, GRASS)
    for x, y in blades:
        body += rect(x, y, 2, 4, GRASS_DARK) + rect(x + 2, y + 2, 2, 2, GRASS_DARK)
    for x, y in [(16, 10), (2, 16), (24, 30)]:
        body += rect(x, y, 2, 2, GRASS_LIGHT)
    return tile(32, 32, body)


def path_tile():
    """320x320 tile: one horizontal and one vertical dirt path with darker edges and pebbles."""
    size, width, hy, vx = 320, 32, 144, 208
    body = rect(0, hy, size, width, DIRT) + rect(vx, 0, width, size, DIRT)
    body += rect(0, hy - 2, vx, 2, DIRT_EDGE) + rect(vx + width, hy - 2, size - vx - width, 2, DIRT_EDGE)
    body += rect(0, hy + width, vx, 2, DIRT_EDGE) + rect(vx + width, hy + width, size - vx - width, 2, DIRT_EDGE)
    body += rect(vx - 2, 0, 2, hy - 2, DIRT_EDGE) + rect(vx - 2, hy + width + 2, 2, size - hy - width - 2, DIRT_EDGE)
    body += rect(vx + width, 0, 2, hy - 2, DIRT_EDGE) + rect(vx + width, hy + width + 2, 2, size - hy - width - 2, DIRT_EDGE)
    for x, y in [(30, hy + 10), (96, hy + 22), (170, hy + 6), (262, hy + 18), (vx + 8, 40), (vx + 20, 110), (vx + 12, 230), (vx + 22, 292)]:
        body += rect(x, y, 4, 2, DIRT_PEBBLE)
    return tile(size, size, body)


def flower_tile():
    """A 232x184 tile with a few spread-out flowers and tufts; its odd size keeps the repeat from lining up with the paths."""
    parts = []
    for rows, x, y in [(FLOWER_RED, 22, 30), (TUFT, 120, 18), (FLOWER_WHITE, 176, 96), (FLOWER_RED, 64, 140), (TUFT, 196, 160)]:
        inner = svg(rows, scale=2, ox=x, oy=y)
        parts.append(inner[inner.index(">") + 1 : -len("</svg>")])
    return tile(232, 184, "".join(parts))


def town_strip():
    """A 176x40 street tile: red-roof house, two trees, blue-roof house, tree."""
    pieces = [(house("R", "r"), 0, 6), (TREE, 50, 8), (TREE, 76, 8), (house("U", "u"), 104, 6), (TREE, 154, 8)]
    parts = []
    for rows, x, y in pieces:
        inner = svg(rows, scale=2, ox=x, oy=y)
        parts.append(inner[inner.index(">") + 1 : -len("</svg>")])
    return f"<svg xmlns='http://www.w3.org/2000/svg' width='176' height='42' shape-rendering='crispEdges'>{''.join(parts)}</svg>"


START, END = "/* --- town details: start --- */", "/* --- town details: end --- */"

css = f"""{START}
/* Original pixel art (hand-built SVG): grass with dirt paths and a few flowers, a row of houses
   and trees under the top bar, a tree line along the bottom edge, and a sprout mascot by the logo. */
:root {{ --backdrop: {GRASS}; }}
html:root {{
  background-color: var(--backdrop);
  background-image: {uri(flower_tile())}, {uri(path_tile())}, {uri(grass_tile())};
  background-size: 232px 184px, 320px 320px, 32px 32px;
}}
main::before {{
  content: '';
  display: block;
  height: 42px;
  margin: -36px -24px 20px;
  background-image: {uri(town_strip())};
  background-repeat: repeat-x;
  background-position: left bottom;
  border-bottom: 4px solid {DIRT_EDGE};
  background-color: {DIRT};
}}
.app::after {{
  content: '';
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 32px;
  z-index: 5;
  pointer-events: none;
  background: {uri(svg(TREE))} repeat-x left bottom;
}}
main {{ padding-bottom: 56px; }}
.brand::after {{
  content: '';
  display: inline-block;
  width: 32px;
  height: 32px;
  margin-left: 12px;
  vertical-align: -6px;
  background: {uri(svg(MASCOT))} no-repeat;
}}
/* The mascot peeks over the Monitor box, keeping an eye on things. */
.q-monitor::before {{
  content: '';
  position: absolute;
  top: -30px;
  left: 170px;
  width: 32px;
  height: 32px;
  background: {uri(svg(MASCOT))} no-repeat;
}}
{END}
"""

path = Path(sys.argv[1])
text = path.read_text()
if START in text:
    text = text[: text.index(START)] + text[text.index(END) + len(END) + 1 :]
path.write_text(text.rstrip("\n") + "\n\n" + css)
print("ok", len(css))
