import sys, json, importlib.util, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

D = "D:/[codex]/2026-10-17/29-21-quadrados-em-2900-2100/outputs/"
n = sys.argv[1]
OUT = sys.argv[2]
spec = importlib.util.spec_from_file_location("floor", f"{OUT}/floor{n}.py")
F = importlib.util.module_from_spec(spec); spec.loader.exec_module(F)
K = getattr(F, 'scale', 1.45)
BRIDGE = 235 if getattr(F, 'auto', False) else 25

src = Image.open(D + getattr(F, "image", f"escola-{n}-andar-realista-29x21-2900x2100.png")).convert("RGB")
im = np.asarray(src).astype(int)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
lum = im.mean(-1); sat = im.max(-1) - im.min(-1)
wall = (lum > 185) & (sat < 60) & (r >= b)
blue = (b > r + 12) & (lum > 110) & (b > 130)
wallx = wall | ndi.binary_dilation(blue, iterations=2)
H, W = wall.shape

# ---- arestas das salas e do contorno (coordenadas de tela 2000px -> orig) ----
edges = []  # (orient, c, a, b)
def add_edge(x1, y1, x2, y2):
    x1, y1, x2, y2 = [v * K for v in (x1, y1, x2, y2)]
    if abs(y1 - y2) < 1: edges.append(["h", (y1 + y2) / 2, min(x1, x2), max(x1, x2)])
    elif abs(x1 - x2) < 1: edges.append(["v", (x1 + x2) / 2, min(y1, y2), max(y1, y2)])
    else: raise ValueError("aresta não ortogonal")
for (x1, y1, x2, y2) in F.rooms:
    add_edge(x1, y1, x2, y1); add_edge(x1, y2, x2, y2); add_edge(x1, y1, x1, y2); add_edge(x2, y1, x2, y2)
pts = F.outline
for i in range(len(pts)):
    (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
    add_edge(x1, y1, x2, y2)
for e in getattr(F, "extra_walls", []):
    add_edge(*e)
if getattr(F, "auto", False):
    A = json.load(open(f"{OUT}/walls{n}.json"))
    for x1, y1, x2, y2 in A["walls"] + A.get("doors", []) + A.get("windows", []):
        if getattr(F, "remove_auto", None) and any(b[0] <= (x1 + x2) / 2 <= b[2] and b[1] <= (y1 + y2) / 2 <= b[3] for b in F.remove_auto):
            continue
        if abs(y1 - y2) < 1: edges.append(["h", float(y1), float(min(x1, x2)), float(max(x1, x2))])
        else: edges.append(["v", float(x1), float(min(y1, y2)), float(max(y1, y2))])

# ---- agrupa arestas colineares próximas e funde sobreposições ----
def merge_edges(orient):
    es = sorted([e for e in edges if e[0] == orient], key=lambda e: e[1])
    groups = []
    for e in es:
        if groups and abs(np.mean([x[1] for x in groups[-1]]) - e[1]) <= 22: groups[-1].append(e)
        else: groups.append([e])
    out = []
    for gp in groups:
        c = float(np.mean([x[1] for x in gp]))
        ss = sorted(gp, key=lambda x: x[2])
        cur = [ss[0][2], ss[0][3]]
        for s in ss[1:]:
            if s[2] <= cur[1] + BRIDGE: cur[1] = max(cur[1], s[3])
            else: out.append([c, cur[0], cur[1]]); cur = [s[2], s[3]]
        out.append([c, cur[0], cur[1]])
    return out

def band(mask, orient, c, a, bnd, half):
    c = int(round(c)); a = int(max(0, a)); bnd = int(min(W if orient == "h" else H, bnd))
    lo, hi = max(0, c - half), min(H if orient == "h" else W, c + half + 1)
    return mask[lo:hi, a:bnd].any(axis=0) if orient == "h" else mask[a:bnd, lo:hi].any(axis=1)

def snap_line(orient, c, a, bnd):
    best, bs = c, -1
    for dc in range(-30, 31):
        cc = c + dc
        sub = band(wallx, orient, cc, a + 20, bnd - 20, 5)
        sc = sub.mean() - abs(dc) * 0.002 if sub.size else 0
        if sc > bs: bs, best = sc, cc
    return best

def on_outline(seg):
    x1, y1, x2, y2 = seg
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    pts = [(a * K, b * K) for a, b in getattr(F, "outline", [])]
    for i in range(len(pts)):
        (ax, ay), (bx, by) = pts[i], pts[(i + 1) % len(pts)]
        if abs(ay - by) < 1 and abs(my - ay) < 26 and min(ax, bx) - 5 <= mx <= max(ax, bx) + 5 and y1 == y2: return True
        if abs(ax - bx) < 1 and abs(mx - ax) < 26 and min(ay, by) - 5 <= my <= max(ay, by) + 5 and x1 == x2: return True
    return False
walls, doors, windows = [], [], []
def snap(v): return int(round(v / 5) * 5)
for orient in ("h", "v"):
    for c, a, bnd in merge_edges(orient):
        c = snap_line(orient, c, a, bnd)
        L = int(bnd - a)
        solid = band(wall, orient, c, a, bnd, 7)
        L = len(solid)
        blu = band(blue, orient, c, a, bnd, 14)
        low = ~solid
        i = 0; cuts = []
        ext = on_outline([a, c, bnd, c] if orient == "h" else [c, a, c, bnd])
        if ext:
            # janelas: faixas azuladas (vidro) ao longo do contorno
            bl = band(blue, orient, c, a, bnd, 16)
            bl = ndi.binary_closing(bl, structure=np.ones(18, bool))
            lab, nl = ndi.label(bl)
            for k, sl in enumerate(ndi.find_objects(lab), 1):
                p, q = sl[0].start, sl[0].stop
                if q - p >= 45 and p > 5 and q < L - 5:
                    cuts.append((p, q, "window"))
            low = low & ~np.isin(np.arange(L), [x for (p, q, _) in cuts for x in range(p, q)])
        while i < L:
            if low[i]:
                j = i
                while j < L and low[j]: j += 1
                ln = j - i
                if 40 <= ln <= 230 and i > 5 and j < L - 5:
                    kind = "window" if blu[i:j].mean() > 0.35 else "door"
                    cuts.append((i, j, kind))
                i = j
            else: i += 1
        cuts.sort()
        last = 0
        def seg(p, q):
            return [snap(a + p), snap(c), snap(a + q), snap(c)] if orient == "h" else [snap(c), snap(a + p), snap(c), snap(a + q)]
        for (i, j, kind) in cuts:
            if i - last > 12: walls.append(seg(last, i))
            (doors if kind == "door" else windows).append(seg(i, j))
            last = j
        if L - last > 12: walls.append(seg(last, L))

# remoções e acréscimos manuais (coordenadas orig)
def near(seg, box):
    x1, y1, x2, y2 = seg
    return box[0] <= (x1 + x2) / 2 <= box[2] and box[1] <= (y1 + y2) / 2 <= box[3]
moved = [d for d in doors if on_outline(d)]
doors = [d for d in doors if not on_outline(d)]
windows += moved
for box in getattr(F, "remove", []):
    walls = [w for w in walls if not near(w, box)]
    doors = [w for w in doors if not near(w, box)]
    windows = [w for w in windows if not near(w, box)]
def cut(ws, seg):
    x1, y1, x2, y2 = seg
    out = []
    for w in ws:
        a1, b1, a2, b2 = w
        if y1 == y2 and b1 == b2 and abs(b1 - y1) <= 14 and min(a2, x2) > max(a1, x1):
            if x1 - a1 > 12: out.append([a1, b1, x1, b1])
            if a2 - x2 > 12: out.append([x2, b1, a2, b1])
        elif x1 == x2 and a1 == a2 and abs(a1 - x1) <= 14 and min(b2, y2) > max(b1, y1):
            if y1 - b1 > 12: out.append([a1, b1, a1, y1])
            if b2 - y2 > 12: out.append([a1, y2, a1, b2])
        else:
            out.append(w)
    return out
for sg in getattr(F, "walls_cut", []):
    walls = cut(walls, sg)
for w in getattr(F, "walls_extra", []):
    walls.append(list(w))
for d in getattr(F, "doors_extra", []):
    walls = cut(walls, d); doors = cut(doors, d); windows = cut(windows, d)
    doors.append(d)
for d in getattr(F, "windows_extra", []):
    walls = cut(walls, d); windows = cut(windows, d)
    windows.append(d)

json.dump({"walls": walls, "doors": doors, "windows": windows}, open(f"{OUT}/final{n}.json", "w"))
print(n, len(walls), len(doors), len(windows))
d = ImageDraw.Draw(src)
for s in walls: d.line(s, fill=(255, 0, 0), width=6)
for s in doors: d.line(s, fill=(0, 255, 0), width=12)
for s in windows: d.line(s, fill=(0, 200, 255), width=12)
src.resize((1450, 1050)).save(f"{OUT}/final{n}.png")
