import json, re, os, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
live=[s for s in json.load(open('../../work/sa/live.json')) if 'cidade' not in s['name']]
LP=json.load(open('C:/Users/Geh/AppData/Local/FoundryVTT/Data/assets/santa-aurora/lights-payload.json'))
cs=40; res={}
for s in live:
    key=re.sub(r'-8000x5800.webp','',os.path.basename(s['bg'])); ox,oy=s['rect']['x'],s['rect']['y']
    Wd,Hd=int(8000/cs),int(5800/cs)
    im=Image.new('L',(Wd,Hd),0); d=ImageDraw.Draw(im)
    for w in s['walls']:
        if w['door'] or w['move']==0: continue
        c=[(v-o)/cs for v,o in zip(w['c'],[ox,oy,ox,oy])]; d.line(c,fill=255,width=2)
    wall=np.asarray(im)>0
    lab,n=ndi.label(~wall)
    # origem: portas e escadas (chegadas) -> ponto livre do lado de fora/pino; usa o maior componente que toca a borda como 'rua'
    edge=np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]]); edge=[e for e in edge if e]
    start=set(edge)
    # portas conectam componentes vizinhos
    def comp_at(x,y):
        X,Y=int((x-ox)/cs),int((y-oy)/cs)
        return lab[Y,X] if 0<=X<Wd and 0<=Y<Hd and lab[Y,X] else 0
    adj={}
    for w in s['walls']:
        if not w['door']: continue
        mx,my=(w['c'][0]+w['c'][2])/2,(w['c'][1]+w['c'][3])/2
        L=max(1,((w['c'][2]-w['c'][0])**2+(w['c'][3]-w['c'][1])**2)**.5); nx,ny=-(w['c'][3]-w['c'][1])/L,(w['c'][2]-w['c'][0])/L
        a=comp_at(mx+nx*70,my+ny*70); b=comp_at(mx-nx*70,my-ny*70)
        if a and b and a!=b: adj.setdefault(a,set()).add(b); adj.setdefault(b,set()).add(a)
    # escadas: chegada aqui conecta ao mundo (considera alcancavel)
    for r in s['regions']:
        if r['name'].startswith('Chegada') and r['shape']:
            c=comp_at(r['shape']['x']+r['shape']['w']/2,r['shape']['y']+r['shape']['h']/2)
            if c: start.add(c)
    seen=set(start); q=list(start)
    while q:
        c=q.pop()
        for nb in adj.get(c,()):
            if nb not in seen: seen.add(nb); q.append(nb)
    pts=LP.get(key,[]); unreach=[]
    for x,y,_ in pts:
        c=comp_at(x*4+ox,y*4+oy)
        if c and c not in seen: unreach.append((int(x),int(y)))
    res[s['name']]=dict(pontos=len(pts),inalcancaveis=unreach)
for n,r in res.items():
    if 'Casa de ' in n or 'Garagem de a' in n: continue
    print(f"{n.encode('ascii','replace').decode():44s} pontos de sala={r['pontos']:2d} inalcancaveis={len(r['inalcancaveis'])} {r['inalcancaveis'][:4]}")
json.dump(res,open('../../work/sa/qa_reach.json','w'))
