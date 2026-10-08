"""Junta work/sa/res_*.json em Data/assets/santa-aurora/walls-payload.json (coordenadas de cena, com o recuo de 25%)."""
import json, glob, os, sys
out = {}
for f in sorted(glob.glob("../../work/sa/res_*.json")):
    n = os.path.basename(f)[4:-5]
    if len(sys.argv) > 1 and n not in sys.argv[1:]: continue
    R = json.load(open(f)); items = []
    q = lambda v: int(round(v * 4))
    for kind, key in (("wall", "walls"), ("door", "doors"), ("window", "windows"), ("rail", "rails")):
        for a, b, c, d in R.get(key, []):
            if abs(a - c) < .05 and abs(b - d) < .05: continue
            items.append({"k": kind, "c": [q(a), q(b), q(c), q(d)]})
    out[n] = items
json.dump(out, open("C:/Users/Geh/AppData/Local/FoundryVTT/Data/assets/santa-aurora/walls-payload.json", "w"))
print({k: len(v) for k, v in out.items()})
