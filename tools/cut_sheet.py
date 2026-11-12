"""Cut a Gemini character sheet (white background, panels in one row) into separate PNGs.

Usage: python3 tools/cut_sheet.py <sheet.png> <name> [sprite_x0 sprite_x1]
       python3 tools/cut_sheet.py --items <sheet.png> <name1> <name2> ...  (writes sprites/item_<name>.png, rows read left to right)
(the optional x range keeps only part of the sprite panel, for example when Gemini drew a desk next to it)
Writes public/assets/portraits/<name>_neutral|happy|angry.png and public/assets/sprites/<name>.png.
The white background around each figure becomes transparent (flood fill from the edges).
No packages needed: macOS sips converts to BMP, this script writes the PNGs.
"""
import struct, subprocess, sys, tempfile, zlib, os
from collections import deque

WHITE = 228        # a pixel is "background" when R, G and B are all above this
MIN_GAP = 12       # empty columns needed between two panels
PORTRAIT_H = 340   # 3D build: keep the full sheet resolution
SPRITE_H = 210      # 3D build: native size of the sprite panel
ITEM_H = 96        # stored item height; the game scales it down to SPOT.ART_H


def load(path):
    tmp = tempfile.mktemp(suffix='.bmp')
    subprocess.run(['sips', '-s', 'format', 'bmp', path, '--out', tmp], check=True, capture_output=True)
    d = open(tmp, 'rb').read(); os.remove(tmp)
    off, = struct.unpack_from('<I', d, 10)
    w, h = struct.unpack_from('<ii', d, 18)
    bpp, = struct.unpack_from('<H', d, 28)
    step = bpp // 8; row = (w * step + 3) & ~3
    flip = h > 0; h = abs(h)
    px = []
    for y in range(h):
        sy = h - 1 - y if flip else y
        base = off + sy * row
        px.append([(d[base + x*step + 2], d[base + x*step + 1], d[base + x*step]) for x in range(w)])
    return w, h, px


def write_png(path, w, h, rgba):
    raw = b''.join(b'\x00' + bytes(v for p in r for v in p) for r in rgba)
    def chunk(t, data):
        return struct.pack('>I', len(data)) + t + data + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def is_bg(p):
    return p[0] > WHITE and p[1] > WHITE and p[2] > WHITE


def panels(w, h, px):
    used = [any(not is_bg(px[y][x]) for y in range(0, h, 2)) for x in range(w)]
    runs, start, gap = [], None, 0
    for x, u in enumerate(used + [False] * MIN_GAP):
        if u:
            if start is None: start = x
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= MIN_GAP:
                runs.append((start, x - gap)); start = None
    return [r for r in runs if r[1] - r[0] > 20]


def cut(w, h, px, x0, x1, open_bottom=False):
    # open_bottom: portraits are cut off at the chest with no outline there. Crop tight at the bottom and
    # never flood from the bottom edge, so white clothes (Rick's lab coat) are not erased.
    # Bounding box rows for this panel
    ys = [y for y in range(h) if any(not is_bg(px[y][x]) for x in range(x0, x1 + 1))]
    y0, y1 = ys[0], ys[-1]
    x0, x1, y0, y1 = max(0, x0 - 4), min(w - 1, x1 + 4), max(0, y0 - 4), (y1 if open_bottom else min(h - 1, y1 + 4))
    cw, ch = x1 - x0 + 1, y1 - y0 + 1
    sub = [row[x0:x1 + 1] for row in px[y0:y1 + 1]]
    clear = [[False] * cw for _ in range(ch)]
    q = deque((x, y) for y in range(ch) for x in (0, cw - 1))
    q.extend((x, y) for x in range(cw) for y in ((0,) if open_bottom else (0, ch - 1)))
    while q:
        x, y = q.popleft()
        if clear[y][x] or not is_bg(sub[y][x]): continue
        clear[y][x] = True
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
            if 0 <= nx < cw and 0 <= ny < ch and not clear[ny][nx]: q.append((nx, ny))
    # 3D build: shave the pale fringe left between the white page and the ink outline (it shows as a halo in 3D)
    for _ in range(3):
        edge = [(x, y) for y in range(ch) for x in range(cw) if not clear[y][x] and min(sub[y][x]) > 150
                and any(0 <= x + dx < cw and 0 <= y + dy < ch and clear[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        for x, y in edge: clear[y][x] = True
    rgba = [[(0, 0, 0, 0) if clear[y][x] else sub[y][x] + (255,) for x in range(cw)] for y in range(ch)]
    return cw, ch, rgba


def save_scaled(path, cw, ch, rgba, height):
    tmp = path + '.full.png'
    write_png(tmp, cw, ch, rgba)
    subprocess.run(['sips', '--resampleHeight', str(height), tmp, '--out', path], check=True, capture_output=True)
    os.remove(tmp)


def runs_of(used, min_gap=MIN_GAP):
    runs, start, gap = [], None, 0
    for i, u in enumerate(used + [False] * min_gap):
        if u:
            if start is None: start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                runs.append((start, i - gap)); start = None
    return [r for r in runs if r[1] - r[0] > 20]


def items(sheet, names):
    # Item sheet: objects in rows on white. Find row bands, then objects in each band, left to right.
    w, h, px = load(sheet)
    bands = runs_of([any(not is_bg(px[y][x]) for x in range(0, w, 2)) for y in range(h)])
    boxes = []
    for y0, y1 in bands:
        for x0, x1 in runs_of([any(not is_bg(px[y][x]) for y in range(y0, y1 + 1, 2)) for x in range(w)]):
            boxes.append((x0, x1, y0, y1))
    if len(boxes) != len(names):
        sys.exit(f'Expected {len(names)} items, found {len(boxes)}: {boxes}')
    for (x0, x1, y0, y1), n in zip(boxes, names):
        band = [row for row in px[max(0, y0 - 6):y1 + 7]]
        save_scaled(f'public/assets/sprites/item_{n}.png', *cut(w, len(band), band, x0, x1), ITEM_H)
    print('items', boxes)


def main():
    if sys.argv[1] == '--items':
        return items(sys.argv[2], sys.argv[3:])
    sheet, name = sys.argv[1], sys.argv[2]
    w, h, px = load(sheet)
    found = panels(w, h, px)
    # Two figures touching (an antenna across the gap): split the widest run at its emptiest column.
    while len(found) < 4:
        i = max(range(len(found)), key=lambda k: found[k][1] - found[k][0])
        a, b = found[i]; third = (b - a) // 3
        ink = lambda x: sum(not is_bg(px[y][x]) for y in range(h))
        cut_x = min(range(a + third, b - third), key=ink)
        found[i:i + 1] = [(a, cut_x - 1), (cut_x + 1, b)]
    if len(found) != 4:
        sys.exit(f'Expected 4 panels, found {len(found)}: {found}')
    os.makedirs('public/assets/portraits', exist_ok=True); os.makedirs('public/assets/sprites', exist_ok=True)
    for (x0, x1), mood in zip(found[:3], ['neutral', 'happy', 'angry']):
        save_scaled(f'public/assets/portraits/{name}_{mood}.png', *cut(w, h, px, x0, x1, open_bottom=True), PORTRAIT_H)
    sx = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else found[3]
    save_scaled(f'public/assets/sprites/{name}.png', *cut(w, h, px, *sx), SPRITE_H)
    print(name, 'panels', found)


main()
