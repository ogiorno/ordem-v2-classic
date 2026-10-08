import json, math, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
live=[s for s in json.load(open('../../work/sa/live.json')) if 'cidade' not in s['name']]
byuuid={}
def seg_dist(p,a,b):
    ax,ay,bx,by=a+b; px,py=p; dx,dy=bx-ax,by-ay; L=dx*dx+dy*dy
    t=0 if L==0 else max(0,min(1,((px-ax)*dx+(py-ay)*dy)/L)); return math.hypot(px-(ax+t*dx),py-(ay+t*dy))
rep={}
for s in live:
    W=s['walls']; ox,oy=s['rect']['x'],s['rect']['y']
    segs=[(w['c'][:2],w['c'][2:]) for w in W]
    loose=[]
    for i,w in enumerate(W):
        for k in (0,2):
            p=(w['c'][k],w['c'][k+1])
            near=min((seg_dist(p,*[tuple(sg[0]),tuple(sg[1])]) for j,sg in enumerate(segs) if j!=i),default=999)
            if near>30: loose.append(dict(kind='porta' if w['door'] else 'janela' if w['sight']==10 else 'grade' if w['sight']==0 else 'parede',p=[round(v) for v in p],gap=round(near)))
    # sobreposição: porta com parede sólida paralela cobrindo
    over=[]
    for i,d in enumerate(W):
        if not d['door']: continue
        dm=((d['c'][0]+d['c'][2])/2,(d['c'][1]+d['c'][3])/2); L=math.dist(d['c'][:2],d['c'][2:])
        for j,w in enumerate(W):
            if j==i or w['door'] or w['move']==0: continue
            wl=math.dist(w['c'][:2],w['c'][2:])
            if wl<1: continue
            # paralelas e sobrepostas
            ux,uy=(d['c'][2]-d['c'][0])/L,(d['c'][3]-d['c'][1])/L
            vx,vy=(w['c'][2]-w['c'][0])/wl,(w['c'][3]-w['c'][1])/wl
            if abs(ux*vy-uy*vx)>0.05: continue
            if seg_dist(dm,tuple(w['c'][:2]),tuple(w['c'][2:]))<14:
                over.append(dict(porta=[round(v) for v in d['c']],parede=[round(v) for v in w['c']]))
    # duplicadas
    dup=0
    keys=set()
    for w in W:
        k=tuple(sorted([tuple(round(v/10) for v in w['c'][:2]),tuple(round(v/10) for v in w['c'][2:])]))
        if k in keys: dup+=1
        keys.add(k)
    # conectividade: raster 50px
    cs=50; Wd,Hd=int(8000/cs),int(5800/cs)
    # celulas: paredes (nao-porta) bloqueiam; portas e janelas: porta passa, janela bloqueia mov
    def raster(include_doors):
        im=Image.new('L',(Wd,Hd),0); d=ImageDraw.Draw(im)
        for w in W:
            if w['door'] and include_doors: continue
            if w['move']==0: continue
            c=[(v-o)/cs for v,o in zip(w['c'],[ox,oy,ox,oy])]
            d.line(c,fill=255,width=2)
        return np.asarray(im)>0
    wall=raster(False)
    lab,n=ndi.label(~wall)
    sizes=ndi.sum(np.ones_like(lab),lab,range(1,n+1))
    # regiao externa = a que toca borda
    edge=set(np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]]))-{0}
    rooms=[i+1 for i,sz in enumerate(sizes) if sz*cs*cs>=250*250 and (i+1) not in edge]
    # com portas fechadas (como parede) quantas salas isoladas; sem portas: quantas continuam isoladas
    wall2=raster(True); lab2,n2=ndi.label(~wall2)
    edge2=set(np.unique(np.r_[lab2[0],lab2[-1],lab2[:,0],lab2[:,-1]]))-{0}
    sizes2=ndi.sum(np.ones_like(lab2),lab2,range(1,n2+1))
    rooms2=[i+1 for i,sz in enumerate(sizes2) if sz*cs*cs>=250*250 and (i+1) not in edge2]
    # salas fechadas (sem portas contadas) que ficam isoladas mesmo com portas abertas
    isol=[]
    for r in rooms2:
        ys,xs=np.where(lab2==r)
        if len(ys)*cs*cs>=250*250: isol.append((int(xs.mean()*cs+ox),int(ys.mean()*cs+oy),int(len(ys)*cs*cs/(200*200))))
    # com portas abertas, a regiao 'isol' ainda e fechada do exterior -> sem entrada
    # esquema: sala rooms (portas fechadas) deve unir-se ao exterior ou a regiao principal quando abertas
    rep[s['name']]=dict(paredes=len(W),portas=sum(1 for w in W if w['door']),janelas=sum(1 for w in W if not w['door'] and w['sight']==10),grades=sum(1 for w in W if w['sight']==0),soltas=loose,sobre=over,dup=dup,salas_isoladas=len(isol),isol=isol,salas_fechadas=len(rooms))
for n,r in rep.items():
    if 'Casa de ' in n or 'Garagem de a' in n: continue
    print(f"{n:42s} soltas={len(r['soltas']):2d} sobreposicoes_porta={len(r['sobre']):d} dup={r['dup']} salas_sem_entrada={r['salas_isoladas']} (fechadas c/ portas fechadas={r['salas_fechadas']})")
json.dump(rep,open('../../work/sa/qa_geom.json','w'))
