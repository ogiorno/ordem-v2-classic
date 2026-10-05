# Extrai o texto do suplemento em ordem de leitura (duas colunas), marcando o símbolo de dado como [d].
import sys, re
import pymupdf
PDF = r"D:\[LIVROS]\[RPG]\[ORDEM-PARANORMAL]\Ordem Paranormal RPG - Sobrevivendo ao Horror v1-3.pdf"
doc = pymupdf.open(PDF)
def page_text(p):
    pg = doc[p - 1]
    d = pg.get_text("dict")
    out = []
    for b in d["blocks"]:
        if b.get("type") != 0:
            continue
        lines = []
        for l in b["lines"]:
            t = ""
            for s in l["spans"]:
                txt = s["text"]
                if "d20" in s["font"].lower():
                    txt = re.sub(r"O", "[d]", txt)
                t += txt
            lines.append(t)
        txt = " ".join(x.strip() for x in lines)
        txt = txt.replace("\u00ad ", "").replace("-\u00ad", "-")
        txt = re.sub("\u00ad$", "\u00ac", txt)
        txt = txt.replace("\u00ad", "")
        txt = re.sub(r"\s+", " ", txt).strip()
        if not txt or "zashimaru" in txt:
            continue
        x0, y0 = b["bbox"][0], b["bbox"][1]
        out.append((0 if x0 < 290 else 1, y0, x0, txt))
    out.sort(key=lambda r: (r[0], r[1]))
    return out
if __name__ == "__main__":
    a, b = int(sys.argv[1]), int(sys.argv[2])
    for p in range(a, b + 1):
        print(f"\n===== PDF {p} =====")
        for col, y, x, t in page_text(p):
            print(f"[c{col} y{int(y)} x{int(x)}] {t}")
