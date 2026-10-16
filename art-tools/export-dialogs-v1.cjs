/* Deterministic UI skins + generated mascot. Offline art/handoff only. */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),abs=p=>path.join(root,p),read=p=>fs.readFileSync(abs(p));
const write=(p,v)=>fs.writeFileSync(abs(p),v),json=(p,o)=>write(p,JSON.stringify(o,null,2)+'\n');
const dir='assets/ui/dialogs/',svg=(w,h,b)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${b}</svg>`;
const rect=(x,y,w,h,r,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
async function emit(name,w,h,b){const s=svg(w,h,b);write(dir+'source/'+name+'.svg',s);await sharp(Buffer.from(s)).png().toFile(abs(dir+name+'.png'));}
async function main(){
  const source=dir+'source/mascot-generated-v1.png',raw=await sharp(read(source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=raw.info.width,t=raw.info.height,r=-1,b=-1;
  for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if(raw.data[(y*raw.info.width+x)*4+3]>=16){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
  const crop={left:Math.max(0,l-8),top:Math.max(0,t-8),width:r-l+17,height:b-t+17};
  const mascot=await sharp(read(source)).extract(crop).extend({left:24,right:24,top:24,bottom:24,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  await sharp(mascot).resize({width:960}).png().toFile(abs(dir+'mascot-v1.png'));
  await sharp(mascot).resize({width:480}).png().toFile(abs(dir+'mascot-480-v1.png'));
  let frame=rect(4,4,1272,952,80,'#A97545')+rect(12,12,1256,936,72,'#DDB575')+rect(28,28,1224,904,58,'#FFF8ED');
  // Sparse baked marks belong only to the fixed corner caps, never the stretch zones.
  for(const [x,y,a] of [[72,22,-12],[1208,22,12],[72,938,12],[1208,938,-12]])frame+=`<ellipse cx="${x}" cy="${y}" rx="15" ry="4" transform="rotate(${a} ${x} ${y})" fill="#BE915F"/>`;
  await emit('panel-frame-v1',1280,960,frame);
  const icons={home:['house-fill.svg','#765238'],play:['play-fill.svg','#FFF8ED'],retry:['arrow-clockwise-fill.svg','#FFF8ED'],pause:['pause-fill.svg','#87613F']};
  for(const [name,[from,color]] of Object.entries(icons))write(dir+`icon-${name}-v1.svg`,read('assets/ui/'+from).toString().replace(/currentColor/g,color));
  const buttonStates={primary:{default:{fill:'#9C5B50',edge:'#805135'},hover:{fill:'#8F4E44',edge:'#765238'},pressed:{fill:'#8F4E44',edge:'#765238'},disabled:{fill:'#C6ABA0',edge:'#AD9385'}},secondary:{default:{fill:'#F2E3CB',edge:'#BE955E'},hover:{fill:'#EBD7B6',edge:'#A97545'},pressed:{fill:'#E6CFA9',edge:'#A97545'},disabled:{fill:'#EAE2D6',edge:'#C9BAA6'}}};
  const assets=[];
  for(const [kind,states] of Object.entries(buttonStates))for(const [state,c] of Object.entries(states)){
    const isPressed=state==='pressed',top=isPressed?6:2,bottom=isPressed?108:104;
    const body=rect(2,top,476,108-top,54,c.edge)+rect(6,top+4,468,bottom-top-4,50,c.fill);
    const name=`button-${kind}-${state}-v1`;await emit(name,480,112,body);assets.push({path:dir+name+'.png',width:480,height:112,kind,state});
  }
  const m=await sharp(read(dir+'mascot-v1.png')).metadata();
  const meta={version:1,baseUnits:'CSS pixels at 1x; raster skins exported at 2x',scope:'art assets, standalone UI reference and programmer handoff; no live game logic changed',palette:{surface:'#FFF8ED',custard:'#F3D994',rim:'#DDB575',crust:'#A97545',ink:'#765238',primary:'#9C5B50',primaryHover:'#8F4E44',primaryText:'#FFF8ED',secondary:'#F2E3CB',secondaryText:'#765238',backdrop:'rgba(64,42,32,0.24)'},panel:{path:dir+'panel-frame-v1.png',source:dir+'source/panel-frame-v1.svg',width:1280,height:960,exportScale:2,nineSlice:{top:128,right:128,bottom:128,left:128},renderBorderCss:64,minCssSize:[240,220],opaqueCenter:true},mascot:{path:dir+'mascot-v1.png',width:m.width,height:m.height,displayWidth:216,decorative:true,source},buttons:{assets,sourceSize:[480,112],nineSlice:{top:48,right:64,bottom:48,left:64},cssBorderWidths:[24,32,24,32],referenceHeight:56,states:buttonStates,textIsRuntime:true},copy:{pause:{title:'已暂停',subtitle:'歇一会儿，继续变长。',secondary:'回到开始界面',primary:'继续游戏'},result:{title:'本轮结束',metricLabel:'最终长度',exampleScore:13,secondary:'回到开始界面',primary:'再来一次'}},typography:{family:'Microsoft YaHei UI, Microsoft YaHei, PingFang SC, system-ui, sans-serif',title:30,subtitle:16,metricLabel:16,score:72,button:16},layout:{maxPanelWidth:560,outerGutter:16,mascotWidth:216,mascotTop:0,skinTop:38,panelPadding:[118,32,28],actionGap:16,buttonHeight:56,compactBelowStageHeight:440,narrowStackBelowWidth:360},reference:'previews/dialogs/dialog-reference-v1.html',handoff:'assets/ui/dialogs/PROGRAMMER-HANDOFF-v1.md'};
  meta.icons=Object.fromEntries(Object.keys(icons).map(name=>[name,dir+`icon-${name}-v1.svg`]));meta.iconSource='Existing Phosphor fill icons; license assets/ui/PHOSPHOR-LICENSE.txt';meta.layout.compactBelowViewportHeight=520;
  json(dir+'dialog-assets-v1.json',meta);
  const files=[dir+'panel-frame-v1.png',dir+'mascot-v1.png',dir+'mascot-480-v1.png',...assets.map(a=>a.path)],checks=[];
  for(const file of files){const {data,info}=await sharp(read(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let edge=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if((x===0||y===0||x===info.width-1||y===info.height-1)&&data[(y*info.width+x)*4+3])edge++;if(edge)throw Error('Canvas edge touched '+file);checks.push({path:file,width:info.width,height:info.height,alpha:true,edgePixels:edge});}
  json('previews/dialogs/asset-verification-v1.json',{version:1,alphaChecks:checks,buttonStateCount:8,panelNineSlice:meta.panel.nineSlice,visualReview:'pending',interactiveReview:'pending'});
  const manifest=JSON.parse(read('assets/asset-manifest-v12.json'));manifest.version=13;
  for(const a of checks)manifest.primaryAssets.push({path:a.path,width:a.width,height:a.height,alpha:true,format:'png',role:a.path.includes('button')?'dialog button skin':a.path.includes('mascot')?'dialog mascot':'dialog nine-slice panel'});
  manifest.supportingFiles.push(dir+'dialog-assets-v1.json',dir+'PROGRAMMER-HANDOFF-v1.md',dir+'source/panel-frame-v1.svg',source,'art-tools/export-dialogs-v1.cjs','previews/dialogs/dialog-style-v1.css','previews/dialogs/dialog-reference-v1.html','previews/dialogs/dialog-prompts-v1.md','previews/dialogs/asset-verification-v1.json');
  manifest.supportingFiles.push(...assets.map(a=>a.path.replace(dir,dir+'source/').replace('.png','.svg')),...Object.values(meta.icons),'art-tools/verify-dialogs-v1.cjs');
  manifest.previewFiles.unshift('previews/dialogs/pause-dialog-v1.png','previews/dialogs/result-dialog-v1.png','previews/dialogs/dialog-comparison-v1.png');manifest.currentDialogs={version:1,metadata:dir+'dialog-assets-v1.json',reference:meta.reference,handoff:meta.handoff};manifest.revision.dialogVersion=1;
  manifest.scope='Art assets, editable sources, standalone UI reference and offline fixtures. No live game logic, UI or transitions changed.';
  manifest.revision.policy='Add branded pause and end-of-round dialogs with a pastry frame, shared mascot, runtime text and numeric score, full button states and programmer handoff. Preserve all previous art and live game code.';
  json('assets/asset-manifest-v13.json',manifest);
  console.log(JSON.stringify({files:checks.length,mascotSize:[m.width,m.height],panelNineSlice:meta.panel.nineSlice,buttonStateCount:8},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
