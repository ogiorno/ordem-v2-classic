import json, math, re, os, sys, numpy as np
from PIL import Image
ASSETS="C:/Users/Geh/AppData/Local/FoundryVTT/Data/"
live=json.load(open('../../work/sa/live.json'))
live=[s for s in live if 'Mapa da cidade' not in s['name']]
res={}
for s in live:
    img=Image.open(ASSETS+s['bg']).convert('RGB').resize((4000,2900),Image.LANCZOS)
    a=np.asarray(img).astype(float); lum=a.mean(-1); sat=a.max(-1)-a.min(-1)
    spec=f"specs/{re.sub(r'-8000x5800.webp','',os.path.basename(s['bg']))}.json"
    thr=json.load(open(spec)).get('thr',75) if os.path.exists(spec) else 75
    dark=(lum<thr)&(sat<55)
    ox,oy=s['rect']['x'],s['rect']['y']
    rows=[];tot=0;good=0
    for w in s['walls']:
        kind='door' if w['door'] else ('window' if w['sight']==10 else ('rail' if w['sight']==0 else 'wall'))
        if kind!='wall': continue
        x1,y1,x2,y2=[(v-o)/2 for v,o in zip(w['c'],[ox,oy,ox,oy])]  # -> 4000 scale px
        L=math.hypot(x2-x1,y2-y1)
        if L<20: continue
        u=((x2-x1)/L,(y2-y1)/L); n=(-u[1],u[0])
        offs=[];miss=0;N=max(3,int(L//12))
        for i in range(N+1):
            t=L*i/N; px,py=x1+u[0]*t,y1+u[1]*t
            best=None
            for sft in range(-40,41):
                X=int(round(px+n[0]*sft)); Y=int(round(py+n[1]*sft))
                if 0<=X<4000 and 0<=Y<2900 and dark[Y,X]:
                    # run center
                    pass
            ss=np.arange(-40,41)
            xs=np.clip(np.round(px+n[0]*ss).astype(int),0,3999); ys=np.clip(np.round(py+n[1]*ss).astype(int),0,2899)
            v=dark[ys,xs]
            runs=[];j=0
            while j<len(v):
                if v[j]:
                    k=j
                    while k<len(v) and v[k]: k+=1
                    if k-j>=5: runs.append((ss[j]+ss[k-1])/2)
                    j=k
                else: j+=1
            if runs: offs.append(min(runs,key=abs))
            else: miss+=1
        cov=1-miss/(N+1)
        med=float(np.median(np.abs(offs))) if offs else 99
        ok=cov>=0.6 and med<=14   # ±14 px (4000 scale) = 28 px cena = 0,14 quadrado
        rows.append((L*2,cov,med,ok,[round(v) for v in w['c']])); tot+=L; good+=L if ok else 0
    res[s['name']]=dict(total=tot*2,ok=good*2,pct=100*good/tot if tot else 0,bad=[r for r in rows if not r[3]])
for n,r in res.items(): print(f"{n:48s} {r['pct']:5.1f}%  paredes fora: {len(r['bad'])}")
json.dump({n:{'pct':r['pct'],'bad':[dict(len=b[0],cov=b[1],off=b[2],c=b[4]) for b in r['bad']]} for n,r in res.items()},open('../../work/sa/qa_align.json','w'))
