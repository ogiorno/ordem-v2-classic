"""Recorte com régua. Uso: view.py <mapa> [x0 y0 x1 y1] [--out arq.png] [--spec specs/<mapa>.json]
Coordenadas em unidades de 2000 px de largura (cena = unidade * 4). Régua a cada 25, rótulo a cada 100."""
import sys, json, os
from PIL import Image, ImageDraw, ImageFont
ASSETS = "C:/Users/Geh/AppData/Local/FoundryVTT/Data/assets/santa-aurora/"
HERE = os.path.dirname(os.path.abspath(__file__))
def find(name):
    for d in os.listdir(ASSETS):
        p = f"{ASSETS}{d}/{name}-8000x5800.webp"
        if os.path.exists(p): return p
    raise SystemExit("mapa não encontrado " + name)
def render(name, box=None, spec=None, out=None, width=1800):
    im = Image.open(find(name)).convert("RGB")
    x0, y0, x1, y1 = box or (0, 0, 2000, 1450)
    crop = im.crop((x0 * 4, y0 * 4, x1 * 4, y1 * 4))
    k = width / (x1 - x0)
    crop = crop.resize((int(width), int((y1 - y0) * k)), Image.LANCZOS)
    d = ImageDraw.Draw(crop, "RGBA")
    f = ImageFont.load_default()
    step = 25
    for gx in range((x0 // step) * step, x1 + 1, step):
        if gx < x0: continue
        X = (gx - x0) * k; big = gx % 100 == 0
        d.line([(X, 0), (X, crop.height)], fill=(255, 255, 0, 110 if big else 45), width=1)
        if big: d.text((X + 2, 2), str(gx), fill=(255, 255, 0, 255), font=f)
    for gy in range((y0 // step) * step, y1 + 1, step):
        if gy < y0: continue
        Y = (gy - y0) * k; big = gy % 100 == 0
        d.line([(0, Y), (crop.width, Y)], fill=(0, 255, 255, 110 if big else 45), width=1)
        if big: d.text((2, Y + 2), str(gy), fill=(0, 255, 255, 255), font=f)
    if spec:
        S = json.load(open(spec))
        col = {"walls": (255, 0, 0, 255), "doors": (0, 255, 0, 255), "windows": (0, 160, 255, 255), "rails": (255, 0, 255, 255)}
        for kind, c in col.items():
            for a, b, c2, dd in S.get(kind, []):
                d.line([((a - x0) * k, (b - y0) * k), ((c2 - x0) * k, (dd - y0) * k)], fill=c, width=3 if kind == "walls" else 5)
    out = out or f"{HERE}/../../work/sa/v_{name}.png"
    crop.save(out); return out
if __name__ == "__main__":
    a = sys.argv[1:]; spec = out = None
    if "--spec" in a: i = a.index("--spec"); spec = a[i + 1]; del a[i:i + 2]
    if "--out" in a: i = a.index("--out"); out = a[i + 1]; del a[i:i + 2]
    box = tuple(map(float, a[1:5])) if len(a) >= 5 else None
    box = tuple(int(v) for v in box) if box else None
    print(render(a[0], box, spec, out))
