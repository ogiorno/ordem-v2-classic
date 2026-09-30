import sys, json, importlib.util, numpy as np
from scipy import ndimage as ndi
from PIL import Image, ImageDraw
n = sys.argv[1]; OUT = sys.argv[2]
spec = importlib.util.spec_from_file_location("floor", f"{OUT}/floor{n}.py"); F = importlib.util.module_from_spec(spec); spec.loader.exec_module(F)
K = getattr(F, "scale", 1.45)
W = json.load(open(f"{OUT}/final{n}.json"))
C = 10
GW, GH = 290, 210
bar = Image.new("L", (GW, GH), 0)
d = ImageDraw.Draw(bar)
for s in W["walls"] + W["windows"] + W["doors"]:
    d.line([s[0] / C, s[1] / C, s[2] / C, s[3] / C], fill=255, width=2)
barr = np.asarray(bar) > 0
free = ~barr
lab, nl = ndi.label(free)
out_label = lab[2, 2]
area = ndi.sum(free, lab, index=np.arange(1, nl + 1)) * C * C
# portas: une os dois lados
parent = list(range(nl + 1))
def find(a):
    while parent[a] != a:
        parent[a] = parent[parent[a]]; a = parent[a]
    return a
def union(a, b):
    a, b = find(a), find(b)
    if a != b: parent[a] = b
def near_label(x, y, rad=6):
    cx, cy = int(x / C), int(y / C)
    best = 0
    for r in range(0, rad):
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                xx, yy = cx + dx, cy + dy
                if 0 <= xx < GW and 0 <= yy < GH and lab[yy, xx] > 0:
                    return lab[yy, xx]
    return 0
doorinfo = []
for s in W["doors"]:
    x1, y1, x2, y2 = s; mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    if y1 == y2: a = near_label(mx, my - 45); b = near_label(mx, my + 45)
    else: a = near_label(mx - 45, my); b = near_label(mx + 45, my)
    if a and b: union(a, b)
    doorinfo.append((s, a, b))
start = (int(F.start[0] * K) if False else int(F.start[0] * getattr(F, "scale", 1.45)), int(F.start[1] * getattr(F, "scale", 1.45)))
sl = near_label(*start)
reach = find(sl)
bad = []
for i in range(1, nl + 1):
    if area[i - 1] < 1500: continue
    if i == out_label: continue
    if find(i) != reach:
        ys, xs = np.nonzero(lab == i)
        bad.append((i, int(area[i - 1]), (int(xs.min() * C), int(ys.min() * C), int(xs.max() * C), int(ys.max() * C))))
print(n, "compartimentos:", sum(1 for i in range(1, nl + 1) if area[i - 1] >= 1500), "| inacessíveis:", len(bad), "| vazamento (início = fora):", find(sl) == find(out_label) and sl == out_label)
for b in sorted(bad, key=lambda t: -t[1]): print("  área", b[1], "caixa", b[2])
# desenho
img = Image.open("D:/[codex]/2026-10-17/29-21-quadrados-em-2900-2100/outputs/" + getattr(F, "image", f"escola-{n}-andar-realista-29x21-2900x2100.png")).convert("RGB")
dd = ImageDraw.Draw(img, "RGBA")
for i, a, box in bad: dd.rectangle(box, fill=(255, 0, 0, 90), outline=(255, 0, 0, 255), width=6)
img.resize((1450, 1050)).save(f"{OUT}/comp{n}.png")
