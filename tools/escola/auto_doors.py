import sys, json, importlib.util, numpy as np
from scipy import ndimage as ndi
from PIL import Image, ImageDraw
n = sys.argv[1]; OUT = sys.argv[2]
spec = importlib.util.spec_from_file_location("floor", f"{OUT}/floor{n}.py"); F = importlib.util.module_from_spec(spec); spec.loader.exec_module(F)
SC = getattr(F, "scale", 1.45)
D = "D:/[codex]/2026-10-17/29-21-quadrados-em-2900-2100/outputs/"
IMG = D + getattr(F, "image", f"escola-{n}-andar-realista-29x21-2900x2100.png")
W = json.load(open(f"{OUT}/final{n}.json"))
C = 10; GW, GH = 290, 210
START = (int(F.start[0] * SC), int(F.start[1] * SC))
src = Image.open(IMG).convert("RGB"); im = np.asarray(src).astype(int)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
wood = (r > g + 14) & (g > b + 6) & (r > 100) & (r < 220)
wood = ndi.binary_opening(wood, iterations=2)
wl, wn = ndi.label(wood)
leaves = []
for i, sl in enumerate(ndi.find_objects(wl), 1):
    ys, xs = sl; h = ys.stop - ys.start; w = xs.stop - xs.start
    L, T = max(h, w), min(h, w)
    area = (wl[sl] == i).sum()
    if L < 38 or L > 110 or T < 7 or T > 70 or area < 200 or area > 5000: continue
    leaves.append(((xs.start + xs.stop) / 2, (ys.start + ys.stop) / 2, w, h))

def analyze(W):
    bar = Image.new("L", (GW, GH), 0); d = ImageDraw.Draw(bar)
    for s in W["walls"] + W["windows"] + W["doors"]:
        d.line([s[0] / C, s[1] / C, s[2] / C, s[3] / C], fill=255, width=2)
    free = ~(np.asarray(bar) > 0)
    lab, nl = ndi.label(free)
    area = np.bincount(lab.ravel(), minlength=nl + 1) * C * C
    parent = list(range(nl + 1))
    def find(a):
        while parent[a] != a: parent[a] = parent[parent[a]]; a = parent[a]
        return a
    def near(x, y, rad=6):
        cx, cy = int(x / C), int(y / C)
        for rr in range(rad):
            for dx in range(-rr, rr + 1):
                for dy in range(-rr, rr + 1):
                    xx, yy = cx + dx, cy + dy
                    if 0 <= xx < GW and 0 <= yy < GH and lab[yy, xx] > 0: return lab[yy, xx]
        return 0
    out_l = lab[2, 2]
    for s in W["doors"]:
        x1, y1, x2, y2 = s; mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        a, b2 = (near(mx, my - 45), near(mx, my + 45)) if y1 == y2 else (near(mx - 45, my), near(mx + 45, my))
        if a and b2 and a != out_l and b2 != out_l: parent[find(a)] = find(b2)
    reach = find(near(*START))
    bad = [i for i in range(1, nl + 1) if i != out_l and area[i] >= 1500 and find(i) != reach]
    return lab, bad, area, near, out_l

def cut_wall(W, seg):
    x1, y1, x2, y2 = seg; res = []
    for w in W["walls"]:
        a1, b1, a2, b2 = w
        if y1 == y2 and b1 == b2 and abs(b1 - y1) <= 14 and min(a2, x2) > max(a1, x1):
            if x1 - a1 > 12: res.append([a1, b1, x1, b1])
            if a2 - x2 > 12: res.append([x2, b1, a2, b1])
        elif x1 == x2 and a1 == a2 and abs(a1 - x1) <= 14 and min(b2, y2) > max(b1, y1):
            if y1 - b1 > 12: res.append([a1, b1, a1, y1])
            if b2 - y2 > 12: res.append([a1, y2, a1, b2])
        else: res.append(w)
    W["walls"] = res

def remove_strips(W):
    lab, bad, area, near, out_l = analyze(W)
    removed = []
    nl = lab.max()
    for i in range(1, nl + 1):
        if i == out_l: continue
        ys, xs = np.nonzero(lab == i)
        x0, x1, y0, y1 = xs.min() * C, xs.max() * C + C, ys.min() * C, ys.max() * C + C
        w, h = x1 - x0, y1 - y0
        if min(w, h) > 70 or area[i] < 3000 or area[i] > 60000: continue
        keep = []
        for wl in W["walls"]:
            a1, b1, a2, b2 = wl
            if w >= h and b1 == b2 and abs(b1 - (y0 - 10)) <= 14 and a2 > x0 - 15 and a1 < x1 + 15:  # parede de cima da faixa
                removed.append(wl); continue
            if h > w and a1 == a2 and abs(a1 - (x0 - 10)) <= 14 and b2 > y0 - 15 and b1 < y1 + 15:
                removed.append(wl); continue
            keep.append(wl)
        W["walls"] = keep
    return removed
rem = remove_strips(W)
print("paredes duplicadas removidas:", len(rem))
added = []
for it in range(4):
    lab, bad, area, near, out_l = analyze(W)
    print("passo", it, "inacessíveis:", len(bad))
    if not bad: break
    progress = False
    for comp in bad:
        mask = lab == comp
        ys, xs = np.nonzero(mask)
        # fronteira da componente (células livres perto de barreira) -> paredes vizinhas
        grown = ndi.binary_dilation(mask, iterations=7)
        best = None
        for (lx, ly, lw, lh) in leaves:
            cx, cy = int(lx / C), int(ly / C)
            if not (0 <= cx < GW and 0 <= cy < GH): continue
            if not grown[cy, cx]: continue
            for w in W["walls"]:
                x1, y1, x2, y2 = w
                if y1 == y2 and x1 - 25 <= lx <= x2 + 25: dd = abs(ly - y1); cand = ("h", y1, lx)
                elif x1 == x2 and y1 - 25 <= ly <= y2 + 25: dd = abs(lx - x1); cand = ("v", x1, ly)
                else: continue
                if dd >= 45: continue
                o_, c_, p_ = cand
                if o_ == "h": la, lb = near(p_, c_ - 45), near(p_, c_ + 45)
                else: la, lb = near(c_ - 45, p_), near(c_ + 45, p_)
                if not la or not lb or la == lb or la == out_l or lb == out_l: continue
                if comp not in (la, lb): continue
                if best is None or dd < best[0]: best = (dd, cand, w)
        if best:
            dd, (o, c, p), w = best
            seg = [int(p - 38), int(c), int(p + 38), int(c)] if o == "h" else [int(c), int(p - 38), int(c), int(p + 38)]
            cut_wall(W, seg); W["doors"].append(seg); added.append(seg); progress = True
    if not progress: break
lab, bad, area, near, out_l = analyze(W)
print("finais inacessíveis:", len(bad), "| portas adicionadas:", len(added))
json.dump(W, open(f"{OUT}/final{n}b.json", "w")); json.dump(added, open(f"{OUT}/added{n}.json", "w"))
dd = ImageDraw.Draw(src, "RGBA")
for s in W["walls"]: dd.line(s, fill=(255, 0, 0, 255), width=6)
for s in W["windows"]: dd.line(s, fill=(0, 200, 255, 255), width=10)
for s in W["doors"]: dd.line(s, fill=(0, 255, 0, 255), width=12)
for s in added: dd.line(s, fill=(255, 0, 255, 255), width=14)
for comp in bad:
    ys, xs = np.nonzero(lab == comp); dd.rectangle([xs.min() * C, ys.min() * C, xs.max() * C, ys.max() * C], outline=(255, 255, 0, 255), width=8)
src.resize((1450, 1050)).save(f"{OUT}/auto{n}.png")

# compartimentos finais (ponto interno bem no meio de cada um) para os testes no Foundry
lab, bad, area, near, out_l = analyze(W)
dt = ndi.distance_transform_edt(lab > 0)
comps = []
for i in range(1, lab.max() + 1):
    if i == out_l or area[i] < 1500: continue
    m = lab == i
    d2 = np.where(m, dt, 0); yy, xx = np.unravel_index(np.argmax(d2), d2.shape)
    ys, xs = np.nonzero(m)
    comps.append({"x": int(xx * C + C / 2), "y": int(yy * C + C / 2), "area": int(area[i]), "box": [int(xs.min() * C), int(ys.min() * C), int(xs.max() * C + C), int(ys.max() * C + C)]})
json.dump(comps, open(f"{OUT}/comps{n}.json", "w"))
print("compartimentos exportados:", len(comps))
