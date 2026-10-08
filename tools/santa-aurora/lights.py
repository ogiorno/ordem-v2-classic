from scipy.spatial import Delaunay
import json,glob,os,numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
out={}
for f in sorted(glob.glob('../../work/sa/res_*.json')):
    n=os.path.basename(f)[4:-5]; R=json.load(open(f))
    W,H=1000,725
    im=Image.new('L',(W,H),0); d=ImageDraw.Draw(im)
    xs=[];ys=[]
    for k in ('walls','doors','windows'):
        for a,b,c,e in R[k]:
            d.line([a/2,b/2,c/2,e/2],fill=255,width=3); xs+= [a,c]; ys+=[b,e]
    wall=np.asarray(im)>0
    lab,nl=ndi.label(~wall)
    border=set(np.unique(np.r_[lab[0],lab[-1],lab[:,0],lab[:,-1]]))
    dt=ndi.distance_transform_edt(~wall)*2
    yy,xx=np.ogrid[:H,:W]
    hull=Delaunay(np.array(list(zip(xs,ys)),float))
    def inside(x,y): return hull.find_simplex([[x,y]])[0]>=0
    def run(allow_border):
        lights=[]
        bb=(min(xs)+30,min(ys)+30,max(xs)-30,max(ys)-30)
        clip=(xx*2>=bb[0])&(xx*2<=bb[2])&(yy*2>=bb[1])&(yy*2<=bb[3])
        for i in range(1,nl+1):
            if i in border and not allow_border: continue
            m=(lab==i)&clip if i in border else (lab==i)
            if m.sum()*4<90*90: continue
            dd=np.where(m,dt,0); sp=380
            while True:
                y,x=np.unravel_index(dd.argmax(),dd.shape)
                if dd[y,x]<45: break
                if inside(x*2,y*2): lights.append([int(x*2),int(y*2),float(min(560,max(230,dd[y,x]*2.4)))])
                dd[((xx*2-x*2)**2+(yy*2-y*2)**2)<(sp*0.75)**2]=0
        return lights
    L=run(False)
    if len(L)<3: L=run(True)
    sx,sy,ex,ey=min(xs),min(ys),max(xs),max(ys)
    for gy in range(int(sy)+120,int(ey),260):
        for gx in range(int(sx)+120,int(ex),260):
            if not inside(gx,gy) or dt[min(H-1,gy//2),min(W-1,gx//2)]<35: continue
            if all((gx-a)**2+(gy-b)**2>330**2 for a,b,_ in L): L.append([gx,gy,300.0])
    out[n]=L; print(n,len(L))
json.dump(out,open('C:/Users/Geh/AppData/Local/FoundryVTT/Data/assets/santa-aurora/lights-payload.json','w'))
