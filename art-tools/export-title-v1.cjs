/* Offline transparent title asset and start-screen placement mockup. */
const fs=require('fs'),path=require('path'),sharp=require('sharp'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),abs=p=>path.join(root,p),read=p=>fs.readFileSync(abs(p));
const write=(p,v)=>fs.writeFileSync(abs(p),v),json=(p,v)=>write(p,JSON.stringify(v,null,2)+'\n');
const image=(x,y,w,h,b)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`;
const svg=(w,h,b)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${b}</svg>`;
const hash=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
async function emit(p,w,h,b){const s=svg(w,h,b);write(p+'.svg',s);await sharp(Buffer.from(s)).png().toFile(abs(p+'.png'));}
async function alphaCheck(p){const {data,info}=await sharp(read(p)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let edge=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if((x===0||y===0||x===info.width-1||y===info.height-1)&&data[(y*info.width+x)*4+3]>0)edge++;return{path:p,width:info.width,height:info.height,alpha:true,nonzeroEdgePixels:edge};}
async function main(){
  const source='assets/ui/source/title-chaochang-dantashe-generated-v1.png',master='assets/ui/title-chaochang-dantashe-v1.png';
  const raw=await sharp(read(source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=raw.info.width,t=raw.info.height,r=-1,b=-1;
  for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if(raw.data[(y*raw.info.width+x)*4+3]>=12){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
  const crop={left:Math.max(0,l-8),top:Math.max(0,t-8),width:r-l+17,height:b-t+17};
  await sharp(read(source)).extract(crop).extend({left:28,right:28,top:28,bottom:28,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(abs(master));
  const m=await sharp(read(master)).metadata(),outputs=[master];
  for(const width of [2000,1600,1200,800,480]){const p=`assets/ui/title-chaochang-dantashe-${width}-v1.png`;await sharp(read(master)).resize({width}).png().toFile(abs(p));outputs.push(p);}
  const checks=[];for(const p of outputs){const q=await alphaCheck(p);if(q.nonzeroEdgePixels)throw Error('Transparent padding failed '+p);checks.push(q);}
  const titleW=1140,titleH=titleW*m.height/m.width,titleX=(1920-titleW)/2,titleY=124;
  let scene=read('previews/art-assets/art-style-scene-v11.svg').toString().replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
  scene=scene.replace('translate(288 192)','translate(288 288)').replace(/<image x="1536" y="384" width="96" height="96" href="data:image\/png;base64,[^"]+"\/>/,'');
  scene=scene.replace(read('assets/snake/head/tart-snake-head-left-v7.png').toString('base64'),read('assets/snake/head/tart-snake-head-left-closed-v1.png').toString('base64'));
  scene+=image(titleX,titleY,titleW,titleH,read(master));
  const play=read('assets/ui/play-fill.svg').toString().replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/currentColor/g,'#FBEFD6');
  scene+='<circle cx="960" cy="866" r="64" fill="#B77666"/>'+`<g transform="translate(932 838) scale(0.22)" fill="#FBEFD6">${play}</g>`;
  await emit('previews/art-assets/start-title-preview-v1',1920,1056,scene);
  await sharp(read('previews/art-assets/start-title-preview-v1.png')).resize(960,528).png().toFile(abs('previews/art-assets/start-title-preview-960-v1.png'));
  const samples='<rect width="1600" height="900" fill="#F8F0E6"/>'+image(130,55,1340,1340*m.height/m.width,read(master))+image(400,430,800,800*m.height/m.width,read('assets/ui/title-chaochang-dantashe-800-v1.png'))+image(560,700,480,480*m.height/m.width,read('assets/ui/title-chaochang-dantashe-480-v1.png'));
  await emit('previews/art-assets/title-scale-preview-v1',1600,900,samples);
  const meta={version:1,text:'超长蛋挞蛇',characterCount:5,master,width:m.width,height:m.height,alpha:true,source,sourceCanvas:[raw.info.width,raw.info.height],sourceCrop:crop,transparentPadding:28,variants:checks.slice(1),paletteReference:'assets/snake/head/tart-snake-head-left-closed-v1.png',design:{DESIGN_VARIANCE:5,MOTION_INTENSITY:1,VISUAL_DENSITY:2,style:'rounded pastry lettering; custard fill, toasted rim and sparse baked spots'},placementExample:{canvas:[1920,1056],title:{x:titleX,y:titleY,width:titleW,height:titleH},bodyOffset:[288,288],note:'Offline art mockup; app layout not changed'},accessibility:{alt:'超长蛋挞蛇',headingLevel:1},fontDependency:'none; raster wordmark'};
  json('assets/ui/title-assets-v1.json',meta);
  const manifest=JSON.parse(read('assets/asset-manifest-v11.json'));manifest.version=12;
  for(const q of checks)manifest.primaryAssets.push({path:q.path,width:q.width,height:q.height,alpha:true,format:'png',role:'start-screen title wordmark'});
  manifest.supportingFiles.push(source,'assets/ui/title-assets-v1.json','assets/ui/README-title-v1.md','art-tools/export-title-v1.cjs','previews/art-assets/title-prompt-v1.md','previews/art-assets/title-verification-v1.json');
  manifest.previewFiles.unshift('previews/art-assets/start-title-preview-v1.png','previews/art-assets/start-title-preview-960-v1.png','previews/art-assets/title-scale-preview-v1.png');manifest.currentTitle={text:'超长蛋挞蛇',version:1,metadata:'assets/ui/title-assets-v1.json',master};manifest.revision.titleVersion=1;manifest.revision.titleStyle='rounded custard-and-pastry title, same muted palette as the snake';
  json('assets/asset-manifest-v12.json',manifest);
  json('previews/art-assets/title-verification-v1.json',{text:'超长蛋挞蛇',textVisualReview:'pending',alphaChecks:checks,sourceCrop:crop,scalePreview:'previews/art-assets/title-scale-preview-v1.png',placementPreview:'previews/art-assets/start-title-preview-v1.png',reference:{path:meta.paletteReference,sha256:hash(meta.paletteReference)},scope:'title asset and offline mockup only; no game logic, live UI or transitions changed'});
  console.log(JSON.stringify({master,width:m.width,height:m.height,text:meta.text,outputs:checks,preview:'previews/art-assets/start-title-preview-v1.png'},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
