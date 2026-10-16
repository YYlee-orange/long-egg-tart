/* Export the image_gen contact-shadow edit. Offline art assets and preview only. */
const fs=require('fs'),path=require('path'),sharp=require('sharp'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),abs=p=>path.join(root,p),read=p=>fs.readFileSync(abs(p));
const write=(p,b)=>fs.writeFileSync(abs(p),b),json=(p,o)=>write(p,JSON.stringify(o,null,2)+'\n');
const image=(x,y,w,h,b)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`;
const label=(x,y,t,size=24)=>`<text x="${x}" y="${y}" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="${size}" fill="#765238">${t}</text>`;
const hash=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
async function emit(p,w,h,b){const s=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${b}</svg>`;write(p+'.svg',s);await sharp(Buffer.from(s)).png().toFile(abs(p+'.png'));}
async function alphaCheck(p){const {data,info}=await sharp(read(p)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let edge=0,count=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(a>0){count++;if(x===0||y===0||x===info.width-1||y===info.height-1)edge++;}}return{path:p,width:info.width,height:info.height,alpha:true,edgePixels:edge,nonzeroPixels:count};}
async function main(){
  const source='assets/food/source/custard-carton-outline-shadow-generated-v8.png',master='assets/food/custard-carton-outline-shadow-v8.png';
  // Remove only imperceptible generator alpha noise on the outermost canvas edge.
  const raw=await sharp(read(source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let clearedEdgePixels=0;
  for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++){if(x!==0&&y!==0&&x!==raw.info.width-1&&y!==raw.info.height-1)continue;const i=(y*raw.info.width+x)*4+3;if(raw.data[i]>0&&raw.data[i]<=2){raw.data[i]=0;clearedEdgePixels++;}}
  await sharp(raw.data,{raw:{width:raw.info.width,height:raw.info.height,channels:4}}).png().toFile(abs(master));
  const m=await sharp(read(master)).metadata();if(m.width!==1254||m.height!==1254||!m.hasAlpha)throw Error('Expected original canvas and transparent background.');
  const crop=JSON.parse(read('previews/art-assets/art-style-verification-v7.json')).food.contentBounds;
  const cropped=await sharp(read(master)).extract(crop).png().toBuffer();
  const outputs=[master];
  for(const size of [48,64,128,256]){const n=Math.round(size*.86),a=Math.floor((size-n)/2),b=size-n-a,p=`assets/food/custard-carton-outline-shadow-${size}-v8.png`;await sharp(cropped).resize(n,n,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).extend({left:a,right:b,top:a,bottom:b,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(abs(p));outputs.push(p);}
  const checks=[];for(const p of outputs){const q=await alphaCheck(p);if(q.edgePixels)throw Error('Transparent sprite margin failed '+p);checks.push(q);}
  const old=read('assets/food/custard-carton-outline-256-v7.png'),next=read('assets/food/custard-carton-outline-shadow-256-v8.png');
  const bg=await sharp(read('assets/backgrounds/picnic-cloth-flat-v1.png')).extract({left:96,top:96,width:960,height:576}).png().toBuffer();
  let compare=image(0,0,960,576,bg)+label(150,55,'原素材',25)+label(620,55,'小落地阴影',25)+image(95,65,320,320,old)+image(565,65,320,320,next);
  compare+=`<rect y="408" width="960" height="168" fill="#F8F0E6"/>`+label(30,454,'实际尺寸',19);
  for(let i=0;i<3;i++){const s=[48,64,128][i],x=215+i*240;compare+=image(x,420,s,s,read(`assets/food/custard-carton-outline-shadow-${s}-v8.png`))+label(x+s+15,491,`${s}px`,18);}
  await emit('previews/art-assets/food-shadow-comparison-v8',960,576,compare);
  const foodPrevious=read('assets/food/custard-carton-outline-128-v7.png').toString('base64'),foodNew=read('assets/food/custard-carton-outline-shadow-128-v8.png').toString('base64');
  let scene=read('previews/art-assets/art-style-scene-v9.svg').toString();if(!scene.includes(foodPrevious))throw Error('Expected prior food in preview');scene=scene.replace(foodPrevious,foodNew);write('previews/art-assets/art-style-scene-v10.svg',scene);await sharp(Buffer.from(scene)).png().toFile(abs('previews/art-assets/art-style-scene-v10.png'));
  const manifest=JSON.parse(read('assets/asset-manifest-v9.json'));manifest.version=10;
  for(const a of manifest.primaryAssets){if(a.path==='assets/food/custard-carton-outline-v7.png')a.path=master;else if(a.path.startsWith('assets/food/'))a.path=a.path.replace('custard-carton-outline-','custard-carton-outline-shadow-').replace('-v7.png','-v8.png');}
  manifest.supportingFiles.push(source,'assets/food/README-shadow-v8.md','art-tools/export-food-shadow-v8.cjs','previews/art-assets/food-shadow-prompt-v8.md','previews/art-assets/food-shadow-verification-v8.json');
  manifest.previewFiles.unshift('previews/art-assets/food-shadow-comparison-v8.png','previews/art-assets/art-style-scene-v10.png');
  Object.assign(manifest.revision,{foodVersion:8,foodShadow:true,foodShadowBase:'assets/food/custard-carton-outline-v7.png',policy:'Keep current picnic cloth and existing character. Add only a small subtle warm contact shadow beneath the outlined carton. Preserve original assets and registration.'});
  manifest.archivedDrafts='All previous background and food variants remain. Current food is outline-shadow-v8; current background is picnic-cloth-flat-v1. Character unchanged.';json('assets/asset-manifest-v10.json',manifest);
  json('previews/art-assets/food-shadow-verification-v8.json',{source,master,method:'built-in image_gen precise-object-edit',originalCanvas:[1254,1254],clearedEdgePixels,normalizationCrop:crop,registration:'reused exact v7 crop and fit parameters; no crop-to-new-shadow rescale',alphaChecks:checks,background:{path:'assets/backgrounds/picnic-cloth-flat-v1.png',sha256:hash('assets/backgrounds/picnic-cloth-flat-v1.png'),unchanged:true},sourceBase:{path:'assets/food/custard-carton-outline-v7.png',sha256:hash('assets/food/custard-carton-outline-v7.png')},visualReview:'pending'});
  console.log(JSON.stringify({master,outputs,transparentMargins:true,normalizationCrop:crop,preview:'previews/art-assets/food-shadow-comparison-v8.png'},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
