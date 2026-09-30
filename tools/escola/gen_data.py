import json, importlib.util, math, sys
OUT = sys.argv[1]
data = {"floors": {}}
def inside(poly, x, y):
    c = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
for n in (1, 2, 3):
    spec = importlib.util.spec_from_file_location("floor", f"{OUT}/floor{n}.py"); F = importlib.util.module_from_spec(spec); spec.loader.exec_module(F)
    K = getattr(F, "scale", 1.45)
    import os
    W = json.load(open(f"{OUT}/final{n}b.json" if os.path.exists(f"{OUT}/final{n}b.json") else f"{OUT}/final{n}.json"))
    rooms = [[int(a * K), int(b * K), int(c * K), int(d * K)] for a, b, c, d in F.rooms]
    lights = []
    for (x1, y1, x2, y2) in rooms:
        w, h = x2 - x1, y2 - y1
        if w < 120 or h < 120: continue
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        # grandes salas recebem mais de uma luz
        nx = max(1, round(w / 520)); ny = max(1, round(h / 520))
        for i in range(nx):
            for j in range(ny):
                px = x1 + w * (i + 0.5) / nx; py = y1 + h * (j + 0.5) / ny
                span = min(w / nx, h / ny)
                bright = round(max(2.0, span / 100 * 1.5 * 0.45), 1)
                dim = round(min(24.0, max(bright + 3, max(w / nx, h / ny) / 100 * 1.5 * 0.62)), 1)
                lights.append({"x": int(px), "y": int(py), "bright": bright, "dim": dim, "kind": "room"})
    outline = [(a * K, b * K) for a, b in getattr(F, "outline", [])]
    # luzes de corredor: grade esparsa dentro do contorno e fora das salas
    if outline:
        xs = [p[0] for p in outline]; ys = [p[1] for p in outline]
        step = 380
        y = min(ys) + step / 2
        while y < max(ys):
            x = min(xs) + step / 2
            while x < max(xs):
                if inside(outline, x, y) and not any(r[0] - 40 <= x <= r[2] + 40 and r[1] - 40 <= y <= r[3] + 40 for r in rooms):
                    lights.append({"x": int(x), "y": int(y), "bright": 3.0, "dim": 8.0, "kind": "corridor"})
                x += step
            y += step
    data["floors"][str(n)] = {"walls": W["walls"], "doors": W["doors"], "windows": W["windows"], "rooms": rooms, "lights": lights}
    print(n, len(W["walls"]), len(W["doors"]), len(W["windows"]), len(rooms), len(lights))
json.dump(data, open(f"{OUT}/escola-data.json", "w"))
