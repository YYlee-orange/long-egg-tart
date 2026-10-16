/* Offline export of the built-in image_gen saturation-only carton revision. */
const fs=require('fs'),path=require('path'),sharp=require('sharp'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),abs=p=>path.join(root,p),read=p=>fs.readFileSync(abs(p));
const write=(p,b)=>fs.writeFileSync(abs(p),b),json=(p,o)=>write(p,JSON.stringify(o,null,2)+'\n');
const image=(x,y,w,h,b)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`;
const label=(x,y,t,size=23)=>`<text x="${x}" y="${y}" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="${size}" fill="#765238">${t}</text>`;
const hash=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
async function emit(p,w,h,b){const s=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${b}</svg>`;write(p+'.svg',s);await sharp(Buffer.from(s)).png().toFile(abs(p+'.png'));}
async function inspect(p){const {data,info}=await sharp(read(p)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let edge=0,sat=0,n=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4,a=data[i+3];if(a&&(x===0||y===0||x===info.width-1||y===info.height-1))edge++;if(a>=250){const hi=Math.max(data[i],data[i+1],data[i+2]),lo=Math.min(data[i],data[i+1],data[i+2]);sat+=hi?(hi-lo)/hi:0;n++;}}return{path:p,width:info.width,height:info.height,alpha:true,edgePixels:edge,opaqueMeanHsvSaturation:+(sat/n).toFixed(4)};}
async function patchSaturation(p,x,y,width,height){const {data}=await sharp(read(p)).extract({left:x,top:y,width,height}).removeAlpha().raw().toBuffer({resolveWithObject:true});let s=0;for(let i=0;i<data.length;i+=3){const hi=Math.max(data[i],data[i+1],data[i+2]),lo=Math.min(data[i],data[i+1],data[i+2]);s+=(hi-lo)/hi;}return +(s/(data.length/3)).toFixed(4);}
async function main(){
  const source='assets/food/source/custard-carton-muted-shadow-generated-v9.png',master='assets/food/custard-carton-muted-shadow-v9.png',base='assets/food/custard-carton-outline-shadow-v8.png';
  const raw=await sharp(read(source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let clearedEdgePixels=0;
  for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++){if(x!==0&&y!==0&&x!==raw.info.width-1&&y!==raw.info.height-1)continue;const i=(y*raw.info.width+x)*4+3;if(raw.data[i]>0&&raw.data[i]<=2){raw.data[i]=0;clearedEdgePixels++;}}
  await sharp(raw.data,{raw:{width:raw.info.width,height:raw.info.height,channels:4}}).png().toFile(abs(master));
  const crop=JSON.parse(read('previews/art-assets/art-style-verification-v7.json')).food.contentBounds,cropped=await sharp(read(master)).extract(crop).png().toBuffer(),outputs=[master];
  for(const size of [48,64,128,256]){const n=Math.round(size*.86),a=Math.floor((size-n)/2),b=size-n-a,p=`assets/food/custard-carton-muted-shadow-${size}-v9.png`;await sharp(cropped).resize(n,n,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).extend({left:a,right:b,top:a,bottom:b,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(abs(p));outputs.push(p);}
  const checks=[];for(const p of outputs){const q=await inspect(p);if(q.edgePixels)throw Error('Transparent margin failed '+p);checks.push(q);}if(checks[0].width!==1254||checks[0].height!==1254)throw Error('Canvas changed');
  const old=await inspect(base);if(checks[0].opaqueMeanHsvSaturation>=old.opaqueMeanHsvSaturation)throw Error('Saturation did not decrease');
  const bg=await sharp(read('assets/backgrounds/picnic-cloth-flat-v1.png')).extract({left:96,top:96,width:1200,height:624}).png().toBuffer();
  let compare=image(0,0,1200,624,bg)+label(140,55,'调整前')+label(540,55,'降低饱和度')+label(935,55,'蛇头配色参考');
  compare+=image(50,70,340,340,read('assets/food/custard-carton-outline-shadow-256-v8.png'))+image(450,70,340,340,read('assets/food/custard-carton-muted-shadow-256-v9.png'))+image(850,120,330,260,read('assets/snake/head/tart-snake-head-left-v7.png'));
  compare+='<rect y="440" width="1200" height="184" fill="#F8F0E6"/>'+label(35,495,'实际尺寸',19);
  for(let i=0;i<3;i++){const s=[48,64,128][i],x=260+i*270;compare+=image(x,465,s,s,read(`assets/food/custard-carton-muted-shadow-${s}-v9.png`))+label(x+s+18,530,`${s}px`,18);}
  await emit('previews/art-assets/food-saturation-comparison-v9',1200,624,compare);
  const prev=read('assets/food/custard-carton-outline-shadow-128-v8.png').toString('base64'),next=read('assets/food/custard-carton-muted-shadow-128-v9.png').toString('base64');
  let scene=read('previews/art-assets/art-style-scene-v10.svg').toString();if(!scene.includes(prev))throw Error('Preview base missing');scene=scene.replace(prev,next);write('previews/art-assets/art-style-scene-v11.svg',scene);await sharp(Buffer.from(scene)).png().toFile(abs('previews/art-assets/art-style-scene-v11.png'));
  const manifest=JSON.parse(read('assets/asset-manifest-v10.json'));manifest.version=11;
  for(const a of manifest.primaryAssets){if(a.path.startsWith('assets/food/'))a.path=a.path.replace('custard-carton-outline-shadow','custard-carton-muted-shadow').replace('-v8.png','-v9.png');}
  manifest.supportingFiles.push(source,'assets/food/README-muted-v9.md','art-tools/export-food-muted-v9.cjs','previews/art-assets/food-muted-prompt-v9.md','previews/art-assets/food-muted-verification-v9.json');manifest.previewFiles.unshift('previews/art-assets/food-saturation-comparison-v9.png','previews/art-assets/art-style-scene-v11.png');
  Object.assign(manifest.revision,{foodVersion:9,foodMuted:true,foodColorReference:'assets/snake/head/tart-snake-head-left-v7.png',foodSaturationBase:base,policy:'Slightly lower the entire carton saturation toward the existing snake palette; retain carton geometry, thick outlines, contact shadow and transparent registration. Background and character files unchanged.'});
  manifest.archivedDrafts='All earlier food variants remain. Current food is muted-shadow-v9; current background is picnic-cloth-flat-v1. Character unchanged.';json('assets/asset-manifest-v11.json',manifest);
  const regions={yellowSide:[850,650,70,180],droplet:[470,800,80,80],outline:[250,650,8,100]},samples={};for(const [k,a] of Object.entries(regions))samples[k]={before:await patchSaturation(base,...a),after:await patchSaturation(master,...a)};
  json('previews/art-assets/food-muted-verification-v9.json',{source,master,method:'built-in image_gen color edit using approved snake head as reference',base,normalizationCrop:crop,clearedEdgePixels,alphaChecks:checks,opaqueMeanSaturation:{before:old.opaqueMeanHsvSaturation,after:checks[0].opaqueMeanHsvSaturation},samples,referenceCustardHsvSaturation:0.3909,background:{path:'assets/backgrounds/picnic-cloth-flat-v1.png',sha256:hash('assets/backgrounds/picnic-cloth-flat-v1.png'),unchanged:true},visualReview:'pending'});
  console.log(JSON.stringify({master,outputs,meanSaturation:{before:old.opaqueMeanHsvSaturation,after:checks[0].opaqueMeanHsvSaturation},samples,transparentMargins:true},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
