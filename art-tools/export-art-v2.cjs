/* Offline asset mastering/export. Requires Node.js + sharp. Does not build a game. */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..');
const abs=p=>path.join(root,p);
const write=(p,s)=>fs.writeFileSync(abs(p),s);
const json=(p,o)=>write(p,JSON.stringify(o,null,2)+'\n');
const f=n=>Number(n.toFixed(3));
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const text=(x,y,s,size=20,fill='#76583E')=>`<text x="${x}" y="${y}" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="${size}" fill="${fill}">${esc(s)}</text>`;
const image=(x,y,w,h,b)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`;
const emit=async(p,w,h,body)=>{const s=svg(w,h,body);write(p+'.svg',s);await sharp(Buffer.from(s)).png().toFile(abs(p+'.png'));return s;};
function area(points){let a=0;for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;}
function distanceLine(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1];const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function simplifyOpen(points,tolerance){
  if(points.length<=2)return points;let max=0,index=0;
  for(let i=1;i<points.length-1;i++){const d=distanceLine(points[i],points[0],points.at(-1));if(d>max){max=d;index=i;}}
  if(max<=tolerance)return [points[0],points.at(-1)];
  return [...simplifyOpen(points.slice(0,index+1),tolerance).slice(0,-1),...simplifyOpen(points.slice(index),tolerance)];
}
function simplifyClosed(points,tolerance=0.8){
  let far=1;for(let i=2;i<points.length;i++)if(Math.hypot(points[i][0]-points[0][0],points[i][1]-points[0][1])>Math.hypot(points[far][0]-points[0][0],points[far][1]-points[0][1]))far=i;
  return [...simplifyOpen(points.slice(0,far+1),tolerance).slice(0,-1),...simplifyOpen([...points.slice(far),points[0]],tolerance).slice(0,-1)];
}
function maskContours(data,w,h){
  const inside=(x,y)=>x>=0&&x<w&&y>=0&&y<h&&data[(y*w+x)*4+3]>=180;
  const edges=new Map(),push=(a,b)=>{const key=a.join(',');if(!edges.has(key))edges.set(key,[]);edges.get(key).push(b);};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(inside(x,y)){
    if(!inside(x,y-1))push([x,y],[x+1,y]);if(!inside(x+1,y))push([x+1,y],[x+1,y+1]);
    if(!inside(x,y+1))push([x+1,y+1],[x,y+1]);if(!inside(x-1,y))push([x,y+1],[x,y]);
  }
  const loops=[];
  while(edges.size){
    const start=edges.keys().next().value,points=[],first=start.split(',').map(Number);let p=first,key=start;
    for(let guard=0;guard<100000;guard++){
      points.push(p);const list=edges.get(key);if(!list)break;p=list.pop();if(!list.length)edges.delete(key);key=p.join(',');if(key===start)break;
    }
    if(points.length>=8&&Math.abs(area(points))>50)loops.push(simplifyClosed(points));
  }
  return loops;
}
function bounds(contours){const a=contours.flat(),xs=a.map(p=>p[0]),ys=a.map(p=>p[1]);const x=Math.min(...xs),y=Math.min(...ys);return {x:f(x),y:f(y),width:f(Math.max(...xs)-x),height:f(Math.max(...ys)-y)};}
const contourD=c=>'M '+c.map(p=>p.map(f).join(' ')).join(' L ')+' Z';
const shapeMarkup=s=>`<path fill="${s.color}" d="${s.contours.map(contourD).join(' ')}"/>`;
async function main(){
  const G=await import('../assets/snake/source/body-geometry-v2.mjs');
  await sharp(abs('assets/backgrounds/source/wood-table-generated-v1.png')).resize(1920,1080,{fit:'fill'}).removeAlpha().png().toFile(abs('assets/backgrounds/wood-table-soft-v2.png'));
  const carton=`<g><path fill="#F0D999" d="M149 105 L153 62 Q154 44 172 48 L354 86 Q370 90 372 109 L377 156 L429 212 L306 280 L75 220 Z"/>
    <path fill="#EDCF86" d="M306 280 L429 212 L429 508 Q429 521 417 528 L319 590 Q309 596 303 589 Z"/>
    <path fill="#FFF0CE" d="M75 220 Q75 207 89 211 L294 267 Q306 270 306 284 L306 581 Q306 599 290 594 L89 532 Q75 528 75 511 Z"/>
    <path fill="#C99B5C" d="M149 105 L377 154 L377 166 L146 117 Z"/>
    <path fill="#C99B5C" d="M377 156 L390 170 L316 276 L304 272 Z"/>
    <path fill="#C99B5C" d="M377 156 L429 212 L391 192 L365 177 Z"/>
    <ellipse cx="224" cy="166" rx="53" ry="36" transform="rotate(-26 224 166)" fill="#FFF6DE" stroke="#C99B5C" stroke-width="2.4"/>
    <path fill="#DEB35F" d="M188 338 C182 338 181 347 177 357 C165 384 137 415 137 444 C137 475 159 496 188 496 C217 496 240 474 240 444 C240 415 211 385 199 357 C195 347 194 338 188 338 Z"/></g>`;
  const cartonSvg=svg(512,640,carton);write('assets/food/source/custard-carton-flat-v5.svg',cartonSvg);
  await sharp(Buffer.from(cartonSvg)).png().toFile(abs('assets/food/custard-carton-flat-v5.png'));
  for(const size of [48,64,128,256])await sharp(Buffer.from(cartonSvg)).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(abs(`assets/food/custard-carton-${size}-v5.png`));
  const original=await sharp(abs('assets/snake/source/decals-generated-v3.png')).metadata();
  const shapes=[],frames={};
  const colors=[G.PALETTE.bakeMedium,G.PALETTE.bakeDark,G.PALETTE.bakeLight,G.PALETTE.bakeMedium,G.PALETTE.bakeLight,G.PALETTE.bakeDark,G.PALETTE.bakeMedium,G.PALETTE.bakeLight,G.PALETTE.bakeDark,G.PALETTE.bakeLight,G.PALETTE.bakeMedium,G.PALETTE.bakeMedium,...Array(4).fill(G.PALETTE.pastryLine)];
  for(let i=0;i<16;i++){
    const col=i%4,row=Math.floor(i/4),left=Math.round(col*original.width/4),top=Math.round(row*original.height/4),right=Math.round((col+1)*original.width/4),bottom=Math.round((row+1)*original.height/4);
    const {data,info}=await sharp(abs('assets/snake/source/decals-generated-v3.png')).extract({left,top,width:right-left,height:bottom-top}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const contours=maskContours(data,info.width,info.height);if(!contours.length)throw Error('Empty decal '+i);
    const b=bounds(contours),scale=Math.min((i<12?148:156)/b.width,(i<12?120:54)/b.height);
    const normalized=contours.map(c=>c.map(p=>[f(128+(p[0]-b.x-b.width/2)*scale),f(128+(p[1]-b.y-b.height/2)*scale)]));
    const name=i<12?`bake-${String(i+1).padStart(2,'0')}`:`pastry-${String(i-11).padStart(2,'0')}`;
    const shape={name,color:colors[i],bounds:bounds(normalized),contours:normalized,sourceCell:{x:left,y:top,w:info.width,h:info.height}};shapes.push(shape);
    const body=shapeMarkup(shape),single=svg(256,256,body);
    write(`assets/snake/decals/${name}-v5.svg`,single);await sharp(Buffer.from(single)).png().toFile(abs(`assets/snake/decals/${name}-v5.png`));
    frames[name]={frame:{x:col*256,y:row*256,w:256,h:256},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:256,h:256},sourceSize:{w:256,h:256},pivot:{x:0.5,y:0.5},contentBounds:shape.bounds,color:shape.color,kind:i<12?'custard-bake-spot':'pastry-rim-line',file:`decals/${name}-v5.png`};
  }
  json('assets/snake/source/decal-shapes-v5.json',{version:5,description:'Editable flat-color contours mastered from built-in image_gen silhouettes. No gradients or raster paint.',shapes});
  const atlasBody=shapes.map((s,i)=>`<g transform="translate(${i%4*256} ${Math.floor(i/4)*256})">${shapeMarkup(s)}</g>`).join('');
  const atlas=svg(1024,1024,atlasBody);write('assets/snake/source/decals-atlas-flat-v5.svg',atlas);await sharp(Buffer.from(atlas)).png().toFile(abs('assets/snake/decals-atlas-flat-v5.png'));
  json('assets/snake/decals-atlas-flat-v5.json',{frames,meta:{image:'decals-atlas-flat-v5.png',format:'RGBA8888',size:{w:1024,h:1024},scale:'1',coordinates:'top-left pixel, untrimmed 256-square frames',padding:'all motifs centered with at least 50px transparent margin per frame',sampler:'linear or nearest; clamp-to-edge; keep transparent RGB zero; no JPEG',version:5}});
  const qa={geometry:[],alpha:[],material:[],scope:'Offline art export and visual fixtures only; runtime behavior is documented, not implemented.'};
  const records=G.materialRecords(3200);json('assets/snake/source/material-layout-v2.json',{seed:20261016,width:64,coordinate:'m is permanent material distance behind the head; growth reveals larger m at the tail',records});
  const geometry=[];
  const straight=G.roundOrthogonal([[-60,96],[252,96]],56);geometry.push({name:'straight',path:straight});
  const corner=G.roundOrthogonal([[96,-60],[96,96],[252,96]],56);
  for(let i=0;i<4;i++)geometry.push({name:['corner-ne','corner-se','corner-sw','corner-nw'][i],path:corner,rotation:i*90});
  geometry.push({name:'cap-right',path:G.roundOrthogonal([[-60,96],[96,96]],56)});
  geometry.push({name:'cap-left',path:G.roundOrthogonal([[96,96],[252,96]],56)});
  for(const item of geometry){
    const body=G.bodyMarkup(item.path,shapes,records,{prefix:item.name,textures:false});
    const markup=item.rotation?`<g transform="rotate(${item.rotation} 96 96)">${body}</g>`:body;
    await emit(`assets/snake/geometry/${item.name}-v2`,192,192,markup);
    qa.geometry.push({sample:item.name,rotation:item.rotation||0,...G.verifyGeometry(item.path)});
  }
  json('assets/snake/geometry/geometry-fixtures-v2.json',{viewBox:[0,0,192,192],structure:G.STRUCTURE,palette:G.PALETTE,fixtures:geometry.map(g=>({name:g.name,rotation:g.rotation||0,path:g.path.d,length:g.path.length})),warning:'Fixtures only. Draw the complete body once; do not tile independently filled pieces.'});
  const wood=fs.readFileSync(abs('assets/backgrounds/wood-table-soft-v2.png'));
  const hero=G.roundOrthogonal([[140,440],[425,440],[425,220],[815,220],[815,500],[1165,500]],100);
  const heroRecords=G.materialRecords(hero.length,88);
  const heroMarkup=G.bodyMarkup(hero,shapes,heroRecords,{width:88,prefix:'hero'});
  const food=await sharp(Buffer.from(cartonSvg)).resize(176,220).png().toBuffer();
  let overview=image(0,0,1600,900,wood)+text(60,78,'超长蛋挞 · 素材预览',36)+heroMarkup+image(1280,274,176,220,food);
  overview+='<rect x="0" y="760" width="1600" height="320" fill="#F8F5EF"/>'+text(60,810,'12 种烤斑 / 4 组酥皮细纹',23);
  shapes.forEach((s,i)=>{overview+=`<g transform="translate(${50+i*94} 825) scale(.32)">${shapeMarkup(s)}</g>`;});
  overview+=text(60,1020,'平涂固有色 · 无投影或固定高光 · 蛇身为连续路径样张',20);
  await emit('previews/art-assets/assets-overview-v2',1600,1080,overview);
  await emit('previews/art-assets/composition-on-wood-v2',1600,900,image(0,0,1600,900,wood)+heroMarkup+image(1280,274,176,220,food));
  const spath=G.roundOrthogonal([[90,175],[270,175],[270,370],[500,370],[500,175],[710,175]],72);
  const upath=G.roundOrthogonal([[930,180],[1420,180],[1420,276],[930,276]],48);
  qa.geometry.push({sample:'continuous-s',...G.verifyGeometry(spath)},{sample:'tight-u',...G.verifyGeometry(upath)});
  await emit('previews/art-assets/continuous-s-v2',800,480,G.bodyMarkup(spath,shapes,records,{prefix:'s'}));
  await emit('previews/art-assets/tight-u-v2',600,260,`<g transform="translate(-860 -95)">${G.bodyMarkup(upath,shapes,records,{prefix:'u'})}</g>`);
  let continuity='<rect width="1600" height="1020" fill="#F8F5EF"/>'+text(60,70,'连续几何检验',34)+text(60,112,'总宽 64 / 外酥皮每侧 6 / 内沿每侧 5 / 内馅 42',20);
  continuity+=G.bodyMarkup(spath,shapes,records,{prefix:'cs'})+G.bodyMarkup(upath,shapes,records,{prefix:'cu'});
  continuity+=text(60,465,'连续 S 弯',22)+text(900,365,'紧密 U 弯：中心半径 48，内侧外轮廓半径 16',20);
  continuity+=text(60,555,'同源接口与圆端',26);
  for(let i=0;i<geometry.length;i++){
    const item=geometry[i],x=55+i*218;
    continuity+=image(x,590,180,180,fs.readFileSync(abs(`assets/snake/geometry/${item.name}-v2.png`)));
    continuity+=text(x,815,['直段','上 / 右','右 / 下','下 / 左','左 / 上','右圆端','左圆端'][i],18);
  }
  continuity+=text(60,930,'接口样张用于核对比例；实际身体应一次绘制完整连续路径。',21);
  await emit('previews/art-assets/geometry-continuity-v2',1600,1020,continuity);
  const track=G.roundOrthogonal([[60,275],[210,275],[210,95],[450,95],[450,275],[620,275]],56);
  const motion=[];
  for(let i=0;i<3;i++){
    const headDistance=600+i*40,route=G.reversePath(G.slicePath(track,0,headDistance));
    const body=G.bodyMarkup(route,shapes,records,{visibleLength:500,prefix:`motion-${i}`});
    await emit(`previews/art-assets/movement-${i+1}-v2`,600,340,body);motion.push({path:route.d,headDistance,length:500,records:records.filter(r=>r.m<=500).map(r=>({id:r.id,m:r.m,variant:r.variant,position:G.at(route,r.m).p}))});
    qa.geometry.push({sample:`movement-${i+1}`,...G.verifyGeometry(route)});
  }
  const growPath=G.reversePath(G.slicePath(track,0,760)),growth=[];
  for(let i=0;i<3;i++){
    const length=360+i*80;
    await emit(`previews/art-assets/growth-${i+1}-v2`,600,340,G.bodyMarkup(growPath,shapes,records,{visibleLength:length,prefix:`growth-${i}`}));
    growth.push({length,path:G.slicePath(growPath,0,length).d,records:records.filter(r=>r.m<=length).map(r=>({id:r.id,m:r.m,variant:r.variant,position:G.at(growPath,r.m).p}))});
  }
  for(let i=1;i<growth.length;i++){
    const previous=new Map(growth[i-1].records.map(r=>[r.id,r]));
    for(const r of growth[i].records)if(previous.has(r.id)&&JSON.stringify(previous.get(r.id))!==JSON.stringify(r))throw Error('Growth changed an existing material record.');
  }
  qa.material.push({check:'growth preserves old material ids, positions and variants',passed:true},{check:'no repeated bake variant among the previous two spots',passed:records.filter(r=>r.kind==='bake').every((r,i,a)=>r.variant!==a[i-1]?.variant&&r.variant!==a[i-2]?.variant)});
  const wrap=G.roundOrthogonal([[520,100],[690,100],[690,260],[920,260]],64);
  const wrapBody=[-600,0,600].map((dx,i)=>`<g transform="translate(${dx} 0)">${G.bodyMarkup(wrap,shapes,records,{prefix:`wrap-${i}`})}</g>`).join('');
  await emit('previews/art-assets/boundary-wrap-v2',600,340,wrapBody);
  qa.geometry.push({sample:'boundary-wrap',...G.verifyGeometry(wrap)});
  json('previews/art-assets/material-state-fixtures-v2.json',{motion,growth,wrap:{viewport:[600,340],unwrappedPath:wrap.d,copyTranslations:[-600,0,600],note:'Each copy uses identical ids and unwrapped geometry. Viewport clips; only true endpoints get round caps.'}});
  let states='<rect width="1600" height="1260" fill="#F8F5EF"/>'+text(60,65,'移动、增长与穿屏样张',34)+text(60,110,'固定纹理编号与材料坐标；以下为静态几何验证，并非游戏实现。',20);
  for(let i=0;i<3;i++){
    states+=image(45+i*520,155,500,283,fs.readFileSync(abs(`previews/art-assets/movement-${i+1}-v2.png`)));
    states+=text(60+i*520,470,`移动 ${i+1}：头部路径距离 ${600+i*40}`,20);
    states+=image(45+i*520,535,500,283,fs.readFileSync(abs(`previews/art-assets/growth-${i+1}-v2.png`)));
    states+=text(60+i*520,850,`增长 ${i+1}：可见材料长度 ${360+i*80}`,20);
  }
  states+=image(45,920,500,283,fs.readFileSync(abs('previews/art-assets/boundary-wrap-v2.png')))+text(620,1005,'穿屏处只裁切路径，不生成新的端帽。',23)+text(620,1050,'两侧复用同一份展开路径和纹理编号。',23);
  await emit('previews/art-assets/material-continuity-v2',1600,1260,states);
  const dark='#71685E',light='#F8F5EF';let foodQA='<rect width="1400" height="720" fill="'+light+'"/>'+text(50,65,'纸盒平涂与缩小检查',32);
  foodQA+='<rect x="40" y="100" width="460" height="570" fill="'+dark+'"/>'+image(80,116,380,475,await sharp(Buffer.from(cartonSvg)).resize(380,475).png().toBuffer());
  foodQA+=image(540,130,256,320,await sharp(Buffer.from(cartonSvg)).resize(256,320).png().toBuffer());
  foodQA+=text(550,500,'透明边缘：深浅底对照',20);
  for(let i=0;i<3;i++){
    const size=[48,64,128][i],x=900+i*150;
    foodQA+=image(x,270,size,size,fs.readFileSync(abs(`assets/food/custard-carton-${size}-v5.png`)))+text(x,450,`${size} × ${size}`,20);
  }
  foodQA+=text(900,540,'三种食物尺寸，均为实际像素显示',18);
  await emit('previews/art-assets/food-alpha-size-v2',1400,720,foodQA);
  const auditFiles=['assets/food/custard-carton-flat-v5.png','assets/snake/decals-atlas-flat-v5.png',...shapes.map(s=>`assets/snake/decals/${s.name}-v5.png`)];
  for(const file of auditFiles){
    const {data,info}=await sharp(abs(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let opaque=0,transparent=0,partial=0;const solidColors=new Set();let edgeNonzero=0;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
      const p=(y*info.width+x)*4,a=data[p+3];if(a===255){opaque++;solidColors.add(`${data[p]},${data[p+1]},${data[p+2]}`);}else if(a===0)transparent++;else partial++;
      if((x===0||y===0||x===info.width-1||y===info.height-1)&&a!==0)edgeNonzero++;
    }
    qa.alpha.push({file,width:info.width,height:info.height,opaquePixels:opaque,transparentPixels:transparent,antialiasedEdgePixels:partial,nonzeroBorderPixels:edgeNonzero,solidColorCount:solidColors.size});
    if(!transparent||edgeNonzero)throw Error('Transparent margins failed: '+file);
  }
  qa.production={method:'Built-in image_gen originals + editable flat SVG masters + offline analytic geometry exports',backgroundSize:[1920,1080],decalAtlasSize:[1024,1024],decalCount:16,foodColors:6,shadowGradientFilterElements:0,geometryChecks:qa.geometry.length};
  json('previews/art-assets/verification-v2.json',qa);
  console.log(JSON.stringify({assets:'background 1920x1080; carton master + four sprite sizes; 16 decals + atlas; 7 geometry fixtures',previews:'overview, wood composition, geometry, motion/growth/wrap, food alpha/scale',checks:qa.production,alpha:qa.alpha.map(a=>({file:a.file,solidColors:a.solidColorCount,border:a.nonzeroBorderPixels}))},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

