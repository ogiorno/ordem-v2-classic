"""Gera specs/<mapa>.json a partir de listas simples: W (paredes), D (portas), N (janelas), R (grades)."""
import json, sys
def spec(name, walls, doors=(), windows=(), rails=()):
    S = {"chains": [{"pts": [list(p) for p in w], "raw": True, "nogaps": True} for w in walls]}
    S["chains"] += [{"pts": [list(p) for p in w], "raw": True, "nogaps": True, "rail": True} for w in rails]
    S["doorsExtra"] = [list(d) for d in doors]; S["windowsExtra"] = [list(d) for d in windows]
    json.dump(S, open(f"specs/{name}.json", "w"))
