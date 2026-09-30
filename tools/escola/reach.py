import sys, json, importlib.util, numpy as np
from collections import deque
n = sys.argv[1]; OUT = sys.argv[2]
spec = importlib.util.spec_from_file_location("floor", f"{OUT}/floor{n}.py"); F = importlib.util.module_from_spec(spec); spec.loader.exec_module(F)
K = getattr(F, "scale", 1.45)
W = json.load(open(f"{OUT}/final{n}.json"))
C = 20
GW, GH = 2900 // C + 1, 2100 // C + 1
blocked_edges = set()  # (cx,cy,dir) moves blocked
def segs_blocking():
    for s in W["walls"] + W["windows"]:
        yield s
def crosses(a, b, seg):
    # a,b: pontos (x,y) do movimento; seg: parede ortogonal
    x1, y1, x2, y2 = seg
    (ax, ay), (bx, by) = a, b
    if y1 == y2:  # parede horizontal
        if (ay - y1) * (by - y1) < 0 and min(x1, x2) - 1 <= ax <= max(x1, x2) + 1: return True
    else:
        if (ax - x1) * (bx - x1) < 0 and min(y1, y2) - 1 <= ay <= max(y1, y2) + 1: return True
    return False
segs = list(segs_blocking())
# índice simples por célula
def blocked(a, b):
    for s in segs:
        if crosses(a, b, s): return True
    return False
start = None
if hasattr(F, "start"): start = (int(F.start[0] * K), int(F.start[1] * K))
else: start = (int(F.rooms[0][0] * K) - 40, int(F.rooms[0][1] * K) - 40)
seen = {(start[0] // C, start[1] // C)}
q = deque([(start[0] // C, start[1] // C)])
while q:
    cx, cy = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = cx + dx, cy + dy
        if not (0 <= nx < GW and 0 <= ny < GH) or (nx, ny) in seen: continue
        a = (cx * C + C // 2, cy * C + C // 2); b = (nx * C + C // 2, ny * C + C // 2)
        if blocked(a, b): continue
        seen.add((nx, ny)); q.append((nx, ny))
bad = []
for i, (x1, y1, x2, y2) in enumerate(F.rooms):
    c = (int((x1 + x2) / 2 * K) // C, int((y1 + y2) / 2 * K) // C)
    if c not in seen: bad.append((i, (x1, y1, x2, y2)))
print(n, "sala(s) inacessível(is):", len(bad), "de", len(F.rooms))
for i, r in bad: print("  ", i, r)
