#!/usr/bin/env python3
"""Cut the approved weapon sheet into the in-game weapon icon atlas.

    pip install pillow && python3 scripts/build_weapon_atlas.py

Source: the approved sheet (94b5d0f9-...png at the repo root). Each weapon tile is flood-filled
from its edges to remove the parchment, trimmed, and fitted into a 96px cell with the same
scale for every weapon of a family. SoulChains that are not drawn on the sheet are recoloured
from the approved chain they are based on. Output: assets/weapons/atlas.png (+ a JSON index
that src/rpg/weaponVisuals.js mirrors in ICON_INDEX).
"""
import colorsys, json, os, sys
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(ROOT, '94b5d0f9-bc5e-4686-a826-b88129be17b8.png')
OUT = os.path.join(ROOT, 'assets', 'weapons')
CELL = 96

SAM = [256, 370, 486, 602, 719, 835, 951, 1068, 1185, 1302]
ARC = [258, 378, 508, 637, 767, 898, 1028, 1159, 1289]
TILES = {}
for bid, x in zip(['shinai', 'rustkatana', 'wakizashi', 'tachi', 'uchigatana', 'nodachi', 'moonkatana', 'onicleaver', 'dragontachi', 'stormedge'], SAM):
    TILES[bid] = (x + 2, 150, x + 104, 276)
for bid, x in zip(['twigbow', 'huntbow', 'recurve', 'longbow', 'composite', 'reedbow', 'elmwarbow', 'galebow', 'sunbow'], ARC):
    TILES[bid] = (x + 2, 364, x + 116, 492)
for bid, x in zip(['twigwand', 'acornstaff', 'crookstaff', 'shroomwand', 'candlestaff', 'owlstaff', 'hexwand', 'frostrod', 'starstaff'], ARC):
    TILES[bid] = (x + 2, 574, x + 116, 704)
for bid, x in zip(['wanderer', 'whispering', 'grieving', 'veilrender', 'eternalbond'], [262, 420, 585, 755, 930]):
    TILES[bid] = (x, 786, x + 150, 920)

# SoulChain bases drawn from an approved chain: (source, hue in degrees or None to keep, saturation x, value x)
CHAIN_VARIANTS = {
    'tetherchain': ('wanderer', None, 1, 1),
    'shrinecord': ('wanderer', 40, 0.9, 1.35),
    'lanternlinks': ('whispering', 30, 0.55, 0.8),
    'ferrymanchain': ('whispering', None, 1, 1),
    'mothsilk': ('whispering', 270, 0.35, 1.12),
    'gravechain': ('grieving', None, 1, 1),
    'wispwoven': ('veilrender', 160, 0.9, 1),
    'veilchain': ('veilrender', None, 1, 1),
    'wayfarerlinks': ('wanderer', 30, 0.2, 1.15),
    'tidewhisper': ('veilrender', 212, 1, 1),
    'duskcoil': ('grieving', 338, 0.8, 0.8),
    'lanternchain': ('eternalbond', 32, 1, 1),
    'threshold': ('eternalbond', None, 1, 1),
}


def parchment(p):
    r, g, b = p[:3]
    return r > 150 and g > 120 and b > 80 and 18 < r - b < 110 and 5 < g - b < 75 and r >= g


def cut(im, box):
    tile = im.crop(box).convert('RGBA')
    w, h = tile.size
    px = tile.load()
    bg = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or bg[x][y] or not parchment(px[x, y]):
            continue
        bg[x][y] = True
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # the parchment seen through a bow string or a chain loop is enclosed: remove large patches
    # that match this tile's own parchment closely (ivory and bone parts stay, they differ)
    samp = sorted((px[x, y][:3] for x in range(w) for y in range(h) if bg[x][y]), key=sum)
    ref = samp[len(samp) // 2] if samp else (235, 217, 174)
    near = lambda p: abs(p[0] - ref[0]) + abs(p[1] - ref[1]) + abs(p[2] - ref[2]) < 34
    seen0 = [[False] * h for _ in range(w)]
    for sx in range(w):
        for sy in range(h):
            if bg[sx][sy] or seen0[sx][sy] or not near(px[sx, sy]):
                continue
            comp, q = [], deque([(sx, sy)])
            while q:
                x, y = q.popleft()
                if x < 0 or y < 0 or x >= w or y >= h or seen0[x][y] or bg[x][y] or not near(px[x, y]):
                    continue
                seen0[x][y] = True
                comp.append((x, y))
                q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
            if len(comp) > 40:
                for (x, y) in comp:
                    bg[x][y] = True
    for x in range(w):
        for y in range(h):
            if bg[x][y]:
                px[x, y] = (0, 0, 0, 0)
    # drop specks and leftover tile-frame lines: keep components that hold dark outline pixels
    seen = [[False] * h for _ in range(w)]
    for sx in range(w):
        for sy in range(h):
            if seen[sx][sy] or px[sx, sy][3] == 0:
                continue
            comp, dark, q = [], 0, deque([(sx, sy)])
            while q:
                x, y = q.popleft()
                if x < 0 or y < 0 or x >= w or y >= h or seen[x][y] or px[x, y][3] == 0:
                    continue
                seen[x][y] = True
                comp.append((x, y))
                if sum(px[x, y][:3]) < 200:
                    dark += 1
                q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
            bright = sum(1 for (x, y) in comp if max(px[x, y][:3]) > 200 and min(px[x, y][:3]) < 190)
            if dark < 3 and not (bright > 4 and len(comp) < 60):  # keep sparkles and glints
                for (x, y) in comp:
                    px[x, y] = (0, 0, 0, 0)
    return tile.crop(tile.getbbox())


def recolor(img, hue, sat, val):
    img = img.copy()
    px = img.load()
    for x in range(img.width):
        for y in range(img.height):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if v < 0.2:  # keep the ink outline
                continue
            if hue is not None:
                h = hue / 360
            s, v = min(1, s * sat), min(1, v * val)
            r, g, b = colorsys.hsv_to_rgb(h, s, v)
            px[x, y] = (int(r * 255), int(g * 255), int(b * 255), a)
    return img


def fit(img, scale):
    w, h = img.size
    k = min(scale, (CELL - 6) / w, (CELL - 6) / h)
    img = img.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    # keep edges crisp: snap alpha after the resample
    px = img.load()
    for x in range(img.width):
        for y in range(img.height):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if a > 110 else 0)
    cell = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
    cell.paste(img, ((CELL - img.width) // 2, (CELL - img.height) // 2), img)
    return cell


def main():
    im = Image.open(SHEET).convert('RGB')
    cuts = {k: cut(im, b) for k, b in TILES.items()}
    # one scale per family so a Wakizashi stays visibly shorter than a Nodachi
    fam = {'katana': list(TILES)[:10], 'bow': list(TILES)[10:19], 'staff': list(TILES)[19:28], 'chain': list(TILES)[28:]}
    scale = {}
    for f, ids in fam.items():
        big = max(max(cuts[i].size) for i in ids)
        for i in ids:
            scale[i] = (CELL - 6) / big
    icons = {k: cuts[k] for k in list(TILES)[:28]}
    for bid, (src, hue, s, v) in CHAIN_VARIANTS.items():
        icons[bid] = cuts[src] if hue is None and s == 1 and v == 1 else recolor(cuts[src], hue, s, v)
        scale[bid] = scale[src]
    ids = list(icons)
    cols = 8
    rows = (len(ids) + cols - 1) // cols
    atlas = Image.new('RGBA', (cols * CELL, rows * CELL), (0, 0, 0, 0))
    index = {}
    for n, bid in enumerate(ids):
        atlas.paste(fit(icons[bid], scale[bid]), ((n % cols) * CELL, (n // cols) * CELL))
        index[bid] = n
    os.makedirs(OUT, exist_ok=True)
    atlas.save(os.path.join(OUT, 'atlas.png'), optimize=True)
    json.dump({'cell': CELL, 'cols': cols, 'index': index}, open(os.path.join(OUT, 'atlas.json'), 'w'), indent=1)
    print('atlas', atlas.size, len(ids), 'icons')


if __name__ == '__main__':
    sys.exit(main())
