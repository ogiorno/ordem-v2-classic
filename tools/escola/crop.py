import sys, json
from PIL import Image, ImageDraw, ImageFont
D = "D:/[codex]/2026-10-17/29-21-quadrados-em-2900-2100/outputs/"
n, x0, y0, w, h = sys.argv[1], *map(int, sys.argv[2:6])
walls = sys.argv[6] if len(sys.argv) > 6 else None
out = sys.argv[7] if len(sys.argv) > 7 else "."
img = Image.open(f"{D}escola-{n}-andar-realista-29x21-2900x2100.png").convert("RGB")
d = ImageDraw.Draw(img)
if walls and walls != "none":
    j = json.load(open(walls))
    for s in j["walls"]: d.line(s, fill=(255, 0, 0), width=3)
    for s in j.get("doors", []): d.line(s, fill=(0, 255, 0), width=7)
    for s in j.get("windows", []): d.line(s, fill=(0, 200, 255), width=7)
c = img.crop((x0, y0, x0 + w, y0 + h))
d = ImageDraw.Draw(c)
f = ImageFont.load_default()
for x in range((x0 // 100) * 100, x0 + w, 100):
    if x < x0: continue
    d.line([(x - x0, 0), (x - x0, 14)], fill=(255, 255, 0), width=2)
    d.text((x - x0 + 2, 14), str(x), fill=(255, 255, 0), font=f)
    d.line([(x - x0, 0), (x - x0, h)], fill=(255, 255, 0, 60), width=1) if x % 500 == 0 else None
for y in range((y0 // 100) * 100, y0 + h, 100):
    if y < y0: continue
    d.line([(0, y - y0), (14, y - y0)], fill=(255, 255, 0), width=2)
    d.text((16, y - y0 - 5), str(y), fill=(255, 255, 0), font=f)
c.save(f"{out}/crop_{n}_{x0}_{y0}.png")
