"""Refina um traçado aproximado (specs/<mapa>.json) contra os pixels: acha o centro da faixa escura de cada parede,
ajusta uma reta, liga os vértices e abre portas nas lacunas. Saída: work/sa/res_<mapa>.json (unidades de 2000 px).
Uso: refine.py <mapa>"""
import sys, json, math, os, numpy as np
from PIL import Image
from view import find, render
HERE = os.path.dirname(os.path.abspath(__file__))
name = sys.argv[1]
S = json.load(open(f"{HERE}/specs/{name}.json"))
thr = S.get("thr", 60); sat_max = S.get("sat", 45)
img = np.asarray(Image.open(find(name)).convert("RGB").resize((4000, 2900), Image.LANCZOS)).astype(float)
dark = ((img.mean(-1) < thr) & ((img.max(-1) - img.min(-1)) < sat_max)).astype(np.uint8)
K = 2.0  # unidades de 2000 -> pixels de 4000
def at(x, y):
    xi, yi = int(round(x * K)), int(round(y * K))
    return dark[yi, xi] if 0 <= xi < 4000 and 0 <= yi < 2900 else 0
RANGE = S.get("range", 12)
def profile(p, n):
    ss = np.arange(-RANGE, RANGE + 0.01, 0.5)
    return ss, np.array([at(p[0] + n[0] * s, p[1] + n[1] * s) for s in ss])
def band_center(ss, v):
    runs, i = [], 0
    while i < len(v):
        if v[i]:
            j = i
            while j < len(v) and v[j]: j += 1
            runs.append((ss[i], ss[j - 1])); i = j
        else: i += 1
    runs = [r for r in runs if 5 <= r[1] - r[0] + 0.5 <= S.get("maxThick", 70)]
    if not runs: return None
    r = min(runs, key=lambda r: abs((r[0] + r[1]) / 2))
    return (r[0] + r[1]) / 2
def fit_segment(a, b):
    L = math.dist(a, b); u = ((b[0] - a[0]) / L, (b[1] - a[1]) / L); n = (-u[1], u[0])
    ts, cs, miss = [], [], []
    t = 0.0
    while t <= L:
        p = (a[0] + u[0] * t, a[1] + u[1] * t)
        c = band_center(*profile(p, n))
        (ts if c is not None else miss).append(t)
        if c is not None: cs.append(c)
        t += 2
    if len(ts) < max(6, 0.3 * (L / 2)): return None
    ts, cs = np.array(ts), np.array(cs)
    keep = np.ones(len(ts), bool)
    for _ in range(4):
        co = np.polyfit(ts[keep], cs[keep], 1)
        res = np.abs(np.polyval(co, ts) - cs)
        nk = res < 2.0
        if nk.sum() < 5 or (nk == keep).all(): break
        keep = nk
    co = np.polyfit(ts[keep], cs[keep], 1)
    if S.get("ortho", True) and (abs(u[0]) > 0.99 or abs(u[1]) > 0.99) and ((L < 220 and abs(co[0]) < 0.12) or abs(co[0]) < 0.012):
        co = np.array([0.0, float(np.mean(cs[keep]))])
    A = (a[0] + n[0] * co[1], a[1] + n[1] * co[1]); B = (b[0] + u[0] * 0 + n[0] * np.polyval(co, L) + u[0] * 0, 0)
    A = (a[0] + n[0] * np.polyval(co, 0), a[1] + n[1] * np.polyval(co, 0))
    B = (b[0] + n[0] * np.polyval(co, L), b[1] + n[1] * np.polyval(co, L))
    # lacunas: trechos sem faixa escura consecutivos
    good = np.zeros(int(L // 2) + 2, bool)
    for t, c, k in zip(ts, cs, keep):
        if k: good[int(t // 2)] = True
    return A, B, good, L
def intersect(p1, p2, p3, p4):
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-6: return None
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))
walls, doors, windows, report = [], [], [], []
rails = []
def in_boxes(seg, boxes):
    mx, my = (seg[0] + seg[2]) / 2, (seg[1] + seg[3]) / 2
    return any(b[0] <= mx <= b[2] and b[1] <= my <= b[3] for b in boxes)
for ci, ch in enumerate(S["chains"]):
    pts = [tuple(p) for p in ch["pts"]]
    if ch.get("closed"): pts = pts + [pts[0]]
    segs = []
    for i in range(len(pts) - 1):
        f = None if ch.get("raw") else fit_segment(pts[i], pts[i + 1])
        if f is None:
            report.append(f"chain {ci} seg {i} {pts[i]}->{pts[i+1]}: sem faixa, mantido")
            L = math.dist(pts[i], pts[i + 1]); f = (pts[i], pts[i + 1], np.ones(int(L // 2) + 2, bool), L)
        segs.append(f)
    # vértices = interseção das retas vizinhas
    P = [segs[0][0]]
    for i in range(len(segs) - 1):
        v = intersect(segs[i][0], segs[i][1], segs[i + 1][0], segs[i + 1][1])
        P.append(v if v and math.dist(v, pts[i + 1]) < 20 else segs[i][1])
    P.append(segs[-1][1])
    if ch.get("closed"):
        v = intersect(segs[-1][0], segs[-1][1], segs[0][0], segs[0][1])
        if v and math.dist(v, pts[0]) < 20: P[0] = v; P[-1] = v
        else: P[-1] = P[0]
    for i, (A, B, good, L) in enumerate(segs):
        a, b = P[i], P[i + 1]
        # lacunas => portas/janelas
        gaps, j = [], 0
        while j < len(good):
            if not good[j]:
                k = j
                while k < len(good) and not good[k]: k += 1
                if S.get("minGap", 40) <= (k - j) * 2 <= S.get("maxGap", 130) and j > 1 and k < len(good) - 2: gaps.append((j * 2, min(k * 2, L)))
                j = k
            else: j += 1
        merged = []
        for g in gaps:
            if merged and g[0] - merged[-1][1] < S.get("mergeGap", 14): merged[-1] = (merged[-1][0], g[1])
            else: merged.append(g)
        gaps = [] if ch.get("nogaps") else merged
        u = ((b[0] - a[0]) / max(1e-6, math.dist(a, b)), (b[1] - a[1]) / max(1e-6, math.dist(a, b)))
        Ln = math.dist(a, b); cur = 0.0
        pt = lambda t: [round(a[0] + u[0] * t, 1), round(a[1] + u[1] * t, 1)]
        for g0, g1 in gaps:
            g0 = max(0, g0 - 1); g1 = min(Ln, g1 + 1)
            if g0 - cur > 2: walls.append(pt(cur) + pt(g0))
            seg = pt(g0) + pt(g1)
            (windows if in_boxes(seg, S.get("windowBoxes", [])) or ch.get("windows") else doors).append(seg)
            cur = g1
        if Ln - cur > 2: (rails if ch.get("rail") else walls).append(pt(cur) + pt(Ln))
# ajustes manuais
def cut(ws, seg):
    out = []
    ax, ay, bx, by = seg
    dx, dy = bx - ax, by - ay; Ls = math.hypot(dx, dy)
    for w in ws:
        wx1, wy1, wx2, wy2 = w
        wl = math.hypot(wx2 - wx1, wy2 - wy1)
        if wl < 1e-6: continue
        ux, uy = (wx2 - wx1) / wl, (wy2 - wy1) / wl
        def dist(px, py): return abs((px - wx1) * -uy + (py - wy1) * ux)
        if dist(ax, ay) > 6 or dist(bx, by) > 6: out.append(w); continue
        t1 = (ax - wx1) * ux + (ay - wy1) * uy; t2 = (bx - wx1) * ux + (by - wy1) * uy
        t1, t2 = sorted((t1, t2))
        if t2 < 0 or t1 > wl: out.append(w); continue
        if t1 > 2: out.append([wx1, wy1, round(wx1 + ux * t1, 1), round(wy1 + uy * t1, 1)])
        if wl - t2 > 2: out.append([round(wx1 + ux * t2, 1), round(wy1 + uy * t2, 1), wx2, wy2])
    return out
for box in S.get("removeDoors", []):
    back = [d for d in doors if in_boxes(d, [box])]
    doors = [d for d in doors if d not in back]; walls += back
for box in S.get("removeWalls", []): walls = [d for d in walls if not in_boxes(d, [box])]
def overlaps(a, b):
    ax, ay, bx, by = a; cx, cy, dx, dy = b
    la = math.hypot(bx - ax, by - ay); lb = math.hypot(dx - cx, dy - cy)
    if la < 1e-6 or lb < 1e-6: return False
    ux, uy = (bx - ax) / la, (by - ay) / la
    def perp(px, py): return abs((px - ax) * -uy + (py - ay) * ux)
    if perp(cx, cy) > 10 or perp(dx, dy) > 10: return False
    t1, t2 = sorted([(cx - ax) * ux + (cy - ay) * uy, (dx - ax) * ux + (dy - ay) * uy])
    return min(t2, la) - max(t1, 0) > 0.3 * min(la, lb)
def snap_to_wall(d):
    # encosta a porta/janela na parede paralela mais próxima que ela cobre (até 12 unidades)
    dx, dy = d[2] - d[0], d[3] - d[1]; L = math.hypot(dx, dy)
    if L < 1e-6: return d
    ux, uy = dx / L, dy / L; best = None
    for w in walls:
        wl = math.hypot(w[2] - w[0], w[3] - w[1])
        if wl < 1e-6: continue
        vx, vy = (w[2] - w[0]) / wl, (w[3] - w[1]) / wl
        if abs(ux * vy - uy * vx) > 0.06: continue
        mx, my = (d[0] + d[2]) / 2, (d[1] + d[3]) / 2
        dist = abs((mx - w[0]) * -vy + (my - w[1]) * vx)
        t = (mx - w[0]) * vx + (my - w[1]) * vy
        if dist <= 12 and -2 <= t <= wl + 2 and (best is None or dist < best[0]): best = (dist, w, vx, vy)
    if not best: return d
    _, w, vx, vy = best
    def proj(px, py):
        t = (px - w[0]) * vx + (py - w[1]) * vy
        return [round(w[0] + vx * t, 1), round(w[1] + vy * t, 1)]
    return proj(d[0], d[1]) + proj(d[2], d[3])

def place(lst, d):
    global walls, doors, windows
    d = snap_to_wall(d)
    walls = cut(walls, d)
    doors = [x for x in doors if not overlaps(d, x)]; windows = [x for x in windows if not overlaps(d, x)]
    (doors if lst == "door" else windows).append(d)
for d in S.get("doorsExtra", []): place("door", d)
for d in S.get("windowsExtra", []): place("window", d)
for d in S.get("wallsExtra", []): walls.append(d)
for box in S.get("doorsToWindows", []):
    mv = [d for d in doors if in_boxes(d, [box])]; doors = [d for d in doors if d not in mv]; windows += mv
json.dump({"walls": walls, "doors": doors, "windows": windows, "rails": rails}, open(f"{HERE}/../../work/sa/res_{name}.json", "w"))
print(name, "paredes", len(walls), "portas", len(doors), "janelas", len(windows)); [print(" ", r) for r in report]
print(render(name, None, f"{HERE}/../../work/sa/res_{name}.json", f"{HERE}/../../work/sa/res_{name}.png", 2000))
