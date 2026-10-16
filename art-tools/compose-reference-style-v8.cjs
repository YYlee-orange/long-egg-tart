/* Compose the latest cartoon-wood reference revision with the existing outline-food trial. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),abs=p=>path.join(root,p),read=p=>fs.readFileSync(abs(p));
const write=(p,v)=>fs.writeFileSync(abs(p),v),json=(p,v)=>write(p,JSON.stringify(v,null,2)+'\n');
const image=(x,y,w,h,b)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`;
const label=(x,y,s,size=24)=>`<text x="${x}" y="${y}" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="${size}" fill="#76583E">${s}</text>`;
async function emit(p,w,h,b){const s=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${b}</svg>`;write(p+'.svg',s);await sharp(Buffer.from(s)).png().toFile(abs(p+'.png'));}
async function main(){
  const background='assets/backgrounds/wood-table-cartoon-v6.png',wood=read(background);
  const bg=await sharp(wood).metadata();if(bg.width!==1920||bg.height!==1080||bg.hasAlpha)throw Error('Expected an opaque 1920x1080 tabletop.');
  for(const [from,to] of [['art-style-scene-v7','art-style-scene-v8'],['art-style-overview-v7','art-style-overview-v8']]){
    let s=read('previews/art-assets/'+from+'.svg').toString();
    s=s.replace(/<image x="0" y="0" width="1600" height="900" href="data:image\/png;base64,[^"]+"\/>/,image(0,0,1600,900,wood));
    s=s.replace('大色块木桌 / 粗线条蛋挞液','卡通木板背景 / 粗线条蛋挞液').replace('木纹以少量宽色带概括，纸盒保留选定造型并增加暖棕色描边。','参考横向木板、简洁木纹与稀疏木结，纸盒采用暖棕色粗描边。');
    if(!s.includes(wood.toString('base64')))throw Error('Background replacement failed.');
    write('previews/art-assets/'+to+'.svg',s);await sharp(Buffer.from(s)).png().toFile(abs('previews/art-assets/'+to+'.png'));
  }
  const old=read('assets/backgrounds/wood-table-soft-v4.png');
  await emit('previews/art-assets/background-style-comparison-v8',1600,530,'<rect width="1600" height="530" fill="#F8F5EF"/>'+label(40,52,'原背景：密集细木纹',26)+label(840,52,'参考重绘：简洁卡通木板',26)+image(0,80,800,450,old)+image(800,80,800,450,wood));
  const ref=read('assets/backgrounds/source/user-wood-reference-v1.png');
  await emit('previews/art-assets/reference-background-comparison-v8',1840,760,'<rect width="1840" height="760" fill="#F8F5EF"/>'+label(40,62,'用户参考：平涂木板',28)+label(760,62,'重绘背景：横向板层与少量木纹',28)+image(40,140,640,480,ref)+image(760,110,1040,585,wood));
  const manifest=JSON.parse(read('assets/asset-manifest-v7.json'));manifest.version=8;
  manifest.primaryAssets.find(x=>x.path.startsWith('assets/backgrounds/')).path=background;
  manifest.supportingFiles.push('assets/backgrounds/source/wood-table-cartoon-generated-v6.png','assets/backgrounds/source/user-wood-reference-v1.png','assets/README-art-style-v8.md','art-tools/compose-reference-style-v8.cjs','previews/art-assets/background-reference-prompts-v6.md','previews/art-assets/art-style-verification-v8.json');
  manifest.previewFiles.unshift('previews/art-assets/art-style-overview-v8.png','previews/art-assets/art-style-scene-v8.png','previews/art-assets/background-style-comparison-v8.png','previews/art-assets/reference-background-comparison-v8.png');
  manifest.revision={backgroundVersion:6,backgroundStyle:'Reference-based flat cartoon horizontal wooden planks, sparse simple grain and knots',foodVersion:7,foodOutlineTrial:true,foodBase:'assets/food/custard-carton-approved-v6.png',policy:'User supplied a specific cartoon wooden-board reference after the first block-color revision; use this reference-based tabletop. Preserve the bold-outline carton trial and all earlier files.'};
  manifest.archivedDrafts='All previous background variants and original approved carton remain. Current background is cartoon-v6; current carton preview is outline-v7. Character and head states are unchanged.';
  json('assets/asset-manifest-v8.json',manifest);
  const food='assets/food/custard-carton-outline-v7.png',q=JSON.parse(read('previews/art-assets/art-style-verification-v7.json'));
  q.version=8;q.background={path:background,width:bg.width,height:bg.height,alpha:!!bg.hasAlpha,reference:'assets/backgrounds/source/user-wood-reference-v1.png'};
  q.food.sha256=crypto.createHash('sha256').update(read(food)).digest('hex');q.food.changedSinceOutlineTrial=false;q.previewReview='pending';
  json('previews/art-assets/art-style-verification-v8.json',q);
  console.log(JSON.stringify({background,dimensions:[bg.width,bg.height],food,foodUnchanged:true,primaryAssets:manifest.primaryAssets.length,reference:'source/user-wood-reference-v1.png'},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
