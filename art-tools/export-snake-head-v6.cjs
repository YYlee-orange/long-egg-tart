/* Offline head-asset export only. Editable master follows the sketch and image_gen studies. */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),abs=p=>path.join(root,p),read=p=>fs.readFileSync(abs(p));
const save=(p,s)=>fs.writeFileSync(abs(p),s),json=(p,o)=>save(p,JSON.stringify(o,null,2)+'\n');
const image=(x,y,w,h,b)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`;
const text=(x,y,s,size=22)=>`<text x="${x}" y="${y}" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="${size}" fill="#765238">${s}</text>`;
const svg=(w,h,b)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${b}</svg>`;
async function emit(p,w,h,b){const s=svg(w,h,b);save(p+'.svg',s);await sharp(Buffer.from(s)).png().toFile(abs(p+'.png'));}
async function main(){
  const G=await import('../assets/snake/source/body-geometry-v2.mjs');
  const src=read('assets/snake/head/source/tart-snake-head-left-v6.svg');
  const master=await sharp(src,{density:288}).png().toBuffer();
  save('assets/snake/head/tart-snake-head-left-v6.png',master);
  const frames={};
  for(const [name,angle] of [['left',0],['up',90],['right',180],['down',270]]){
    const b=angle?await sharp(master).rotate(angle).png().toBuffer():master;
    const file=`assets/snake/head/tart-snake-head-${name}-v6.png`;if(angle)save(file,b);
    const m=await sharp(b).metadata();
    const rotatePoint=([x,y])=>angle===90?[880-y,x]:angle===180?[1120-x,880-y]:angle===270?[y,1120-x]:[x,y];
    frames[name]={path:file,width:m.width,height:m.height,alpha:m.hasAlpha,defaultFacing:name,neckAnchorPx:rotatePoint([1048,432]),rotationPivotPx:rotatePoint([740,432]),neckWidthPx:512,bodyWidthToImageScale:'runtimeBodyWidth / 512',neckOverlapRecommendedPx:8};
    for(const size of [128,256,512])await sharp(b).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(abs(`assets/snake/head/tart-snake-head-${name}-${size}-v6.png`));
  }
  const styles={width:128,headHeight:160,neckHeight:128,neckRatio:0.8,outerCrustPerSide:12,innerRimPerSide:10,custardWidth:84,neckCutX:262,neckCenterY:108,defaultFacing:'left',palette:{...G.PALETTE,face:'#765238'}};
  json('assets/snake/head/head-assets-v6.json',{version:6,source:'source/tart-snake-head-left-v6.svg',units:'SVG source units; master PNG is four pixels per unit',structure:styles,frames,note:'Render the body behind the open neck, remove the placeholder head cap, keep gameplay collision unchanged. Rotate around the configured pivot and use the matching neck anchor. Current art only; no runtime code changed.'});
  const check={version:6,source:'assets/snake/head/source/tart-snake-head-left-v6.svg',geometry:{headHeight:160,neckHeight:128,ratio:128/160,bodyWidth:128,outerCrust:12,innerRim:10,custard:84},raster:[]};
  for(const name of ['left','up','right','down']){
    const file=frames[name].path,{data,info}=await sharp(read(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let border=0,opaque=0,transparent=0;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(a===255)opaque++;else if(a===0)transparent++;if((x===0||y===0||x===info.width-1||y===info.height-1)&&a>0)border++;}
    if(border||!opaque||!transparent)throw Error('Invalid head alpha '+name);
    check.raster.push({path:file,width:info.width,height:info.height,nonzeroBorderPixels:border,opaquePixels:opaque,transparentPixels:transparent});
  }
  const leftRaw=await sharp(master).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alphaAt=(x,y)=>leftRaw.data[(y*leftRaw.info.width+x)*4+3];
  let headTop=880,headBottom=0,neckTop=880,neckBottom=0;
  for(let y=0;y<880;y++){for(let x=0;x<1120;x++)if(alphaAt(x,y)>200){headTop=Math.min(headTop,y);headBottom=Math.max(headBottom,y);}if(alphaAt(1044,y)>200){neckTop=Math.min(neckTop,y);neckBottom=Math.max(neckBottom,y);}}
  check.rasterRatio={headHeight:headBottom-headTop+1,neckHeight:neckBottom-neckTop+1,ratio:(neckBottom-neckTop+1)/(headBottom-headTop+1)};
  if(Math.abs(check.rasterRatio.ratio-.8)>.005)throw Error('80 percent neck ratio failed.');
  if(/<(filter|linearGradient|radialGradient)\b/.test(src.toString()))throw Error('Master contains baked lighting.');
  check.flatPalettePass=true;check.previewReview='pending';json('previews/art-assets/snake-head-verification-v6.json',check);
  const wood=read('assets/backgrounds/wood-table-soft-v4.png');
  const shapes=JSON.parse(read('assets/snake/source/decal-shapes-v5.json')).shapes;
  const connected=G.roundOrthogonal([[256,231],[530,231],[530,410],[920,410]],80);
  const records=G.materialRecords(connected.length,96);
  const body=G.bodyMarkup(connected,shapes,records,{width:96,prefix:'head-body'});
  const headPreview=await sharp(src).resize(210,165).png().toBuffer();
  await emit('previews/art-assets/snake-head-connection-v6',1120,600,image(0,0,1120,600,wood)+body+image(60,150,210,165,headPreview));
  let board='<rect width="1400" height="940" fill="#F8F5EF"/>'+text(45,65,'蛋挞蛇头 · 宽颈定稿',34)+text(45,110,'颈部厚度为头高的 80%，沿用现有酥皮与内馅配色',22);
  board+=image(45,155,560,440,master);
  const connectedPng=read('previews/art-assets/snake-head-connection-v6.png');board+=image(650,180,700,375,connectedPng)+text(670,605,'与连续蛇身的接口样张',22);
  for(let i=0;i<4;i++){const name=['left','up','right','down'][i],x=45+i*335;board+=image(x,670,240,190,read(frames[name].path))+text(x+78,910,['朝左','朝上','朝右','朝下'][i],20);}
  await emit('previews/art-assets/snake-head-preview-v6',1400,940,board);
  console.log(JSON.stringify({ratio:check.rasterRatio,frames,palette:styles.palette},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
