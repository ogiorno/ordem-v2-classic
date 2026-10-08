import json, sys
from PIL import Image, ImageDraw
live=json.load(open('../../work/sa/live.json')); rep=json.load(open('../../work/sa/qa_geom.json'))
want=[int(x) for x in sys.argv[1:]]
names=[s['name'] for s in live if 'cidade' not in s['name']]
for i in want:
    n=names[i]; s=[x for x in live if x['name']==n][0]; ox,oy=s['rect']['x'],s['rect']['y']
    im=Image.open('C:/Users/Geh/AppData/Local/FoundryVTT/Data/'+s['bg']).convert('RGB').resize((2000,1450)); d=ImageDraw.Draw(im)
    for w in s['walls']:
        c=[(v-o)/4 for v,o in zip(w['c'],[ox,oy,ox,oy])]
        col=(0,255,0) if w['door'] else (0,170,255) if w['sight']==10 else (255,0,255) if w['sight']==0 else (255,0,0)
        d.line(c,fill=col,width=3)
    for l in rep[n]['soltas']:
        x,y=(l['p'][0]-ox)/4,(l['p'][1]-oy)/4; d.ellipse([x-9,y-9,x+9,y+9],outline=(255,255,0),width=3)
    for x,y,a in rep[n]['isol']:
        x,y=(x-ox)/4,(y-oy)/4; d.ellipse([x-25,y-25,x+25,y+25],outline=(255,128,0),width=5)
    im.save(f'../../work/sa/g_{i}.png'); print(i,n.encode('ascii','replace').decode())
