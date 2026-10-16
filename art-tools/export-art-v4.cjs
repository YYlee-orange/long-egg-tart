/* Approved-carton/background revision only. No game/UI changes. Node.js + sharp. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),abs=p=>path.join(root,p);
const read=p=>fs.readFileSync(abs(p)),write=(p,v)=>fs.writeFileSync(abs(p),v);
const json=(p,v)=>write(p,JSON.stringify(v,null,2)+'\n');
const hash=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const image=(x,y,w,h,b)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`;
const label=(x,y,t,s=22)=>`<text x="${x}" y="${y}" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="${s}" fill="#76583E">${t}</text>`;
const svg=(w,h,b)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${b}</svg>`;
const emit=async(p,s)=>{write(p+'.svg',s);await sharp(Buffer.from(s)).png().toFile(abs(p+'.png'));};
async function main(){
  const source='assets/food/source/custard-carton-approved-v6.png',master='assets/food/custard-carton-approved-v6.png';
  fs.copyFileSync(abs(source),abs(master));
  const {data,info}=await sharp(read(source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let minX=info.width,minY=info.height,maxX=-1,maxY=-1,transparent=0,border=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    const a=data[(y*info.width+x)*4+3];
    if(a>0){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(x===0||y===0||x===info.width-1||y===info.height-1)border++;}else transparent++;
  }
  if(maxX<0||!transparent||border)throw Error('Approved carton must retain transparent margins.');
  const contentBounds={left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1};
  const cropped=await sharp(read(source)).extract(contentBounds).png().toBuffer();
  for(const size of [48,64,128,256]){
    const inset=Math.round(size*0.86),padA=Math.floor((size-inset)/2),padB=size-inset-padA;
    await sharp(cropped).resize(inset,inset,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).extend({top:padA,bottom:padB,left:padA,right:padB,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(abs(`assets/food/custard-carton-${size}-v6.png`));
  }
  const background='assets/backgrounds/wood-table-soft-v4.png';
  await sharp(read('assets/backgrounds/source/wood-table-generated-v4.png')).resize(1920,1080,{fit:'fill'}).removeAlpha().png().toFile(abs(background));
  const newWood=read(background),oldWood=read('assets/backgrounds/wood-table-soft-v2.png');
  const foodPreview=await sharp(cropped).resize(176,220,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  for(const name of ['assets-overview','composition-on-wood']){
    let s=read(`previews/art-assets/${name}-v2.svg`).toString();
    s=s.replace(/<image x="0" y="0" width="1600" height="900" href="data:image\/png;base64,[^"]+"\/>/,image(0,0,1600,900,newWood));
    s=s.replace(/<image x="1280" y="274" width="176" height="220" href="data:image\/png;base64,[^"]+"\/>/,image(1280,274,176,220,foodPreview));
    s=s.replace('平涂固有色 · 无投影或固定高光 · 蛇身为连续路径样张','蛋挞液采用选定版本 · 木桌配色加深 · 连续蛇身样张');
    if(!s.includes(newWood.toString('base64'))||!s.includes(foodPreview.toString('base64')))throw Error('Preview asset replacement failed.');
    await emit(`previews/art-assets/${name}-v4`,s);
  }
  const comparison=svg(1600,530,'<rect width="1600" height="530" fill="#F8F5EF"/>'+label(40,50,'原木色',26)+label(840,50,'稍深木色',26)+image(0,80,800,450,oldWood)+image(800,80,800,450,newWood));
  await emit('previews/art-assets/wood-color-comparison-v4',comparison);
  let foodQA='<rect width="1400" height="720" fill="#F8F5EF"/>'+label(50,65,'选定蛋挞液：透明轮廓与缩小检查',32);
  foodQA+='<rect x="40" y="100" width="460" height="570" fill="#71685E"/>';
  foodQA+=image(80,116,380,475,await sharp(cropped).resize(380,475,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer());
  foodQA+=image(540,130,256,320,await sharp(cropped).resize(256,320,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer())+label(550,500,'选图原样保留，深浅底对照',20);
  for(let i=0;i<3;i++){const size=[48,64,128][i],x=900+i*150;foodQA+=image(x,270,size,size,read(`assets/food/custard-carton-${size}-v6.png`))+label(x,450,`${size} × ${size}`,20);}
  foodQA+=label(900,540,'三种食物尺寸，均为实际像素显示',18);
  await emit('previews/art-assets/food-alpha-size-v4',svg(1400,720,foodQA));
  const oldStats=await sharp(oldWood).stats(),newStats=await sharp(newWood).stats();
  const meanLuma=s=>s.channels[0].mean*.2126+s.channels[1].mean*.7152+s.channels[2].mean*.0722;
  const decrease=1-meanLuma(newStats)/meanLuma(oldStats);
  if(decrease<=0||decrease>0.15)throw Error('Background revision should be only slightly darker.');
  const manifest=JSON.parse(read('assets/asset-manifest-v2.json'));
  manifest.version=4;manifest.date='2026-10-16';
  for(const item of manifest.primaryAssets){
    if(item.path.includes('backgrounds/'))item.path=background;
    else if(item.path.includes('custard-carton-flat-v5.png'))item.path=master;
    else if(item.path.includes('food/'))item.path=item.path.replace('-v5.png','-v6.png');
    const m=await sharp(read(item.path)).metadata();Object.assign(item,{width:m.width,height:m.height,alpha:!!m.hasAlpha});
  }
  manifest.supportingFiles=manifest.supportingFiles.filter(p=>!p.includes('assets/food/source/')&&!p.includes('verification-v2.json')&&!p.includes('art-tools/export-art-v2')&&!p.includes('art-tools/verify-delivery-v2'));
  manifest.supportingFiles.push(source,'assets/backgrounds/source/wood-table-generated-v4.png','art-tools/export-art-v4.cjs','assets/README-art-assets-v4.md','previews/art-assets/verification-v4.json','previews/art-assets/image-prompt-background-v4.md');
  manifest.previewFiles=['previews/art-assets/assets-overview-v4.png','previews/art-assets/composition-on-wood-v4.png','previews/art-assets/wood-color-comparison-v4.png','previews/art-assets/food-alpha-size-v4.png','previews/art-assets/geometry-continuity-v2.png','previews/art-assets/material-continuity-v2.png'];
  manifest.revision={approvedCarton:source,foodVersion:6,backgroundVersion:4,snakeAssetsVersion:5,policy:'The user selected the earlier rendered carton. Preserve its cap thickness, exact colors and soft within-panel shading. This selection supersedes the older food-only flat-paint restriction.'};
  manifest.archivedDrafts='Previous sources, flat carton versions, backgrounds, manifests, previews and delivery v2 are retained. Current primaryAssets selects the approved carton v6 and slightly darker tabletop v4.';
  json('assets/asset-manifest-v4.json',manifest);
  const validation={version:4,carton:{source,master,sourceHash:hash(source),masterHash:hash(master),identicalToApprovedFile:hash(source)===hash(master),width:info.width,height:info.height,contentBounds,transparentPixels:transparent,nonzeroBorderPixels:border},background:{file:background,width:1920,height:1080,alpha:false,previousMeanLuma:meanLuma(oldStats),currentMeanLuma:meanLuma(newStats),lumaDecreaseFraction:decrease,method:'Built-in image_gen palette edit; mechanical final-size export only'},snake:{unchanged:true,previousVerification:'previews/art-assets/verification-v2.json'},previewReview:'pending visual inspection'};
  json('previews/art-assets/verification-v4.json',validation);
  console.log(JSON.stringify({approvedCartonRetained:validation.carton.identicalToApprovedFile,foodAlphaBorder:border,backgroundLumaDecreasePercent:Number((decrease*100).toFixed(2)),primaryAssetCount:manifest.primaryAssets.length,previews:manifest.previewFiles},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

