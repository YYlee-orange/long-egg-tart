/* Asset preview/export only: simplified tabletop + approved-carton outline trial. */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),abs=p=>path.join(root,p),read=p=>fs.readFileSync(abs(p));
const write=(p,s)=>fs.writeFileSync(abs(p),s),json=(p,o)=>write(p,JSON.stringify(o,null,2)+'\n');
const image=(x,y,w,h,b)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`;
const label=(x,y,s,z=24)=>`<text x="${x}" y="${y}" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="${z}" fill="#76583E">${s}</text>`;
async function emit(p,w,h,b){const s=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${b}</svg>`;write(p+'.svg',s);await sharp(Buffer.from(s)).png().toFile(abs(p+'.png'));}
async function alphaBounds(buffer){const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,t=info.height,r=-1,b=-1,border=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);if(x===0||y===0||x===info.width-1||y===info.height-1)border++;}return {left:l,top:t,width:r-l+1,height:b-t+1,border};}
async function main(){
  const background='assets/backgrounds/wood-table-blocks-v5.png';
  if(!fs.existsSync(abs(background)))throw Error('Wait for the background art export before composing.');
  const foodSource='assets/food/source/custard-carton-outline-generated-v7.png',foodMaster='assets/food/custard-carton-outline-v7.png';
  fs.copyFileSync(abs(foodSource),abs(foodMaster));
  const master=read(foodMaster),bounds=await alphaBounds(master);
  if(bounds.border)throw Error('Outlined sprite needs transparent outer margins.');
  const {border,...crop}=bounds;
  const trimmed=await sharp(master).extract(crop).png().toBuffer();
  const spriteFiles=[];
  for(const size of [48,64,128,256]){
    const content=Math.round(size*.86),a=Math.floor((size-content)/2),b=size-content-a;
    const file=`assets/food/custard-carton-outline-${size}-v7.png`;
    await sharp(trimmed).resize(content,content,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).extend({left:a,right:b,top:a,bottom:b,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(abs(file));spriteFiles.push(file);
  }
  const oldMaster=read('assets/food/custard-carton-approved-v6.png'),oldBounds=await alphaBounds(oldMaster),oldTrimmed=await sharp(oldMaster).extract({left:oldBounds.left,top:oldBounds.top,width:oldBounds.width,height:oldBounds.height}).png().toBuffer();
  const fit=async(b,w,h)=>sharp(b).resize(w,h,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  const wood=read(background),oldWood=read('assets/backgrounds/wood-table-soft-v4.png');
  let snake=read('previews/art-assets/snake-head-connection-v7.svg').toString();
  snake=snake.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
  snake=snake.replace(/<image x="0" y="0" width="1120" height="600" href="data:image\/png;base64,[^"]+"\/>/,'');
  let scene=image(0,0,1600,900,wood)+`<g transform="translate(60 80) scale(1.25)">${snake}</g>`;
  scene+=image(1270,150,160,220,await fit(trimmed,160,220));
  await emit('previews/art-assets/art-style-scene-v7',1600,900,scene);
  let overview=scene+'<rect y="900" width="1600" height="250" fill="#F8F5EF"/>'+label(55,956,'大色块木桌 / 粗线条蛋挞液',30)+label(55,1000,'木纹以少量宽色带概括，纸盒保留选定造型并增加暖棕色描边。',22);
  overview+=label(55,1080,'纸盒实际像素尺寸',19);
  for(let i=0;i<3;i++){const size=[48,64,128][i],x=355+i*230;overview+=image(x,1015,size,size,read(`assets/food/custard-carton-outline-${size}-v7.png`))+label(x+size+16,1080,`${size}px`,18);}
  await emit('previews/art-assets/art-style-overview-v7',1600,1150,overview);
  const bgCompare='<rect width="1600" height="530" fill="#F8F5EF"/>'+label(40,52,'原背景：细木纹',26)+label(840,52,'重绘背景：概括色块',26)+image(0,80,800,450,oldWood)+image(800,80,800,450,wood);
  await emit('previews/art-assets/background-style-comparison-v7',1600,530,bgCompare);
  let foodCompare='<rect width="1500" height="850" fill="#F8F5EF"/>'+label(45,62,'蛋挞液粗线条试稿',32);
  foodCompare+=image(70,135,350,440,await fit(oldTrimmed,350,440))+image(570,135,350,440,await fit(trimmed,350,440))+image(1060,240,350,275,read('assets/snake/head/tart-snake-head-left-closed-v1.png'));
  foodCompare+=label(155,635,'原选定纸盒',23)+label(660,635,'暖棕色粗线条',23)+label(1135,635,'现有角色',23);
  for(let i=0;i<3;i++){const size=[48,64,128][i],x=90+i*470;foodCompare+=image(x,690,size,size,read(`assets/food/custard-carton-${size}-v6.png`))+image(x+170,690,size,size,read(`assets/food/custard-carton-outline-${size}-v7.png`))+label(x,835,`${size}px 原图 / 粗线条`,18);}
  await emit('previews/art-assets/food-outline-comparison-v7',1500,850,foodCompare);
  const manifest=JSON.parse(read('assets/asset-manifest-v6.json'));manifest.version=7;
  for(const item of manifest.primaryAssets){
    if(item.path.includes('assets/backgrounds/'))item.path=background;
    else if(item.path==='assets/food/custard-carton-approved-v6.png')item.path=foodMaster;
    else if(item.path.startsWith('assets/food/'))item.path=item.path.replace('custard-carton-','custard-carton-outline-').replace('-v6.png','-v7.png');
    const m=await sharp(read(item.path)).metadata();Object.assign(item,{width:m.width,height:m.height,alpha:!!m.hasAlpha});
  }
  manifest.supportingFiles.push(foodSource,'assets/backgrounds/source/wood-table-blocks-generated-v5.png','assets/README-art-style-v7.md','art-tools/export-style-revision-v7.cjs','previews/art-assets/food-outline-prompt-v7.md','previews/art-assets/background-blocks-prompts-v5.md','previews/art-assets/art-style-verification-v7.json');
  manifest.previewFiles.unshift('previews/art-assets/art-style-overview-v7.png','previews/art-assets/art-style-scene-v7.png','previews/art-assets/background-style-comparison-v7.png','previews/art-assets/food-outline-comparison-v7.png');
  manifest.revision={backgroundVersion:5,backgroundStyle:'Few broad flat wood-color bands; no fine grain',foodVersion:7,foodOutlineTrial:true,foodBase:'assets/food/custard-carton-approved-v6.png',policy:'User requested a simplified block-color tabletop and bold outlines on the selected carton. Preserve the earlier files for comparison.'};
  manifest.archivedDrafts='Previous backgrounds, original selected carton, head states and all prior manifests remain in the project. This delivery updates the tabletop and supplies a bold-outline carton trial.';
  json('assets/asset-manifest-v7.json',manifest);
  const alphaChecks=[];for(const file of [foodMaster,...spriteFiles]){const m=await sharp(read(file)).metadata(),b=await alphaBounds(read(file));if(b.border)throw Error('Alpha border failed '+file);alphaChecks.push({file,width:m.width,height:m.height,alpha:m.hasAlpha,nonzeroBorderPixels:b.border});}
  const bg=await sharp(wood).metadata();if(bg.width!==1920||bg.height!==1080||bg.hasAlpha)throw Error('Background format failed.');
  json('previews/art-assets/art-style-verification-v7.json',{version:7,background:{path:background,width:bg.width,height:bg.height,alpha:!!bg.hasAlpha},food:{source:foodSource,master:foodMaster,base:'assets/food/custard-carton-approved-v6.png',contentBounds:crop,outline:'warm toasted brown',status:'visual trial'},alphaChecks,unchanged:['snake body','snake head open state','snake head closed state'],previewReview:'pending'});
  console.log(JSON.stringify({background,food:foodMaster,primaryAssets:manifest.primaryAssets.length,transparentMarginsPass:true,previews:manifest.previewFiles.slice(0,4)},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
