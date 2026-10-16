/* Edit the approved native master locally: mouth only. No regeneration of the head or neck. */
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),abs=p=>path.join(root,p),read=p=>fs.readFileSync(abs(p));
const write=(p,s)=>fs.writeFileSync(abs(p),s),json=(p,o)=>write(p,JSON.stringify(o,null,2)+'\n');
const image=(x,y,w,h,b)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`;
const label=(x,y,s,size=24)=>`<text x="${x}" y="${y}" font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="${size}" fill="#765238">${s}</text>`;
async function main(){
  const oldMouth='C14 112 20 116 27 114 L48 108 Q54 106 57 114 L64 127 Q68 133 74 129 L101 114 Q106 111 110 118 L118 130 Q122 136 128 132 L146 122 Q153 118 155 127 L158 138 L158 149 Q157 152 153 146 L149 137 Q146 132 140 136 L125 145 Q119 149 114 143 L103 129 Q99 125 94 129 L68 145 Q62 149 58 142 L45 125 Q40 120 36 128';
  const newMouth='C14 112 20 116 27 114 Q30 120 36 128';
  let source=read('assets/snake/head/source/tart-snake-head-left-v7.svg').toString();
  if(!source.includes(oldMouth))throw Error('Approved mouth path was not found; refuse to alter the master.');
  source=source.replace(oldMouth,newMouth).replace('蛋挞蛇头：可编辑宽颈定稿，颈部128 / 头高160','蛋挞蛇头：闭嘴状态，颈部128 / 头高160保持不变');
  const mouthLine='<g clip-path="url(#head-shape)"><path d="M30 120 Q40 118 49 116 Q54 114 57 120 L65 132 Q68 135 74 132 L101 120 Q106 117 110 124 L118 136 Q122 140 128 136 L146 127 Q152 124 154 132 L157 142" fill="none" stroke="#A97545" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>';
  source=source.replace(/<\/g>\s*<\/svg>\s*$/,mouthLine+'\n</g>\n</svg>\n');
  const sourceFile='assets/snake/head/source/tart-snake-head-left-closed-v1.svg';write(sourceFile,source);
  const closed=await sharp(Buffer.from(source),{density:288}).png().toBuffer();
  const original=read('assets/snake/head/tart-snake-head-left-v7.png');
  const a=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const b=await sharp(closed).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(a.info.width!==b.info.width||a.info.height!==b.info.height)throw Error('Sprite dimensions changed.');
  let changed=0,neckChanges=0,faceChanges=0,minX=a.info.width,minY=a.info.height,maxX=0,maxY=0;
  for(let y=0;y<a.info.height;y++)for(let x=0;x<a.info.width;x++){
    const p=(y*a.info.width+x)*4;
    if(a.data[p]!==b.data[p]||a.data[p+1]!==b.data[p+1]||a.data[p+2]!==b.data[p+2]||a.data[p+3]!==b.data[p+3]){
      changed++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      if(x>=696)neckChanges++;
      if(x>=656&&x<=820&&y>=200&&y<=400)faceChanges++;
    }
  }
  if(!changed||neckChanges||faceChanges)throw Error('Mouth-only invariant failed.');
  if(maxX>680||minY<360||maxY>700)throw Error('Pixel changes extend beyond the mouth area.');
  const mouthSample=(buffer,x,y)=>buffer[(y*a.info.width+x)*4+3];
  if(mouthSample(a.data,330,530)!==0||mouthSample(b.data,330,530)!==255)throw Error('Mouth opening was not closed.');
  const base=JSON.parse(read('assets/snake/head/head-assets-v7.json'));
  const frames={},files=[];
  for(const [name,angle] of [['left',0],['up',90],['right',180],['down',270]]){
    const buffer=angle?await sharp(closed).rotate(angle).png().toBuffer():closed;
    const file=`assets/snake/head/tart-snake-head-${name}-closed-v1.png`;write(file,buffer);files.push(file);
    frames[name]={...base.frames[name],path:file,state:'closed',compatibleOpenPath:base.frames[name].path};
    for(const size of [128,256,512]){
      const small=`assets/snake/head/tart-snake-head-${name}-${size}-closed-v1.png`;
      await sharp(buffer).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(abs(small));files.push(small);
    }
  }
  const states={version:1,baseOpenVersion:7,structure:base.structure,states:{open:{metadata:'head-assets-v7.json',frames:base.frames},closed:{source:sourceFile,frames}},switching:'Open and closed share dimensions, scale, pivot and neck anchor. Switch the image only; do not resize or reposition the head.'};
  json('assets/snake/head/head-states-v1.json',states);
  const verification={version:1,method:'Native SVG mouth-path edit on the approved v7 master; existing head/neck paths and face retained.',dimensions:[a.info.width,a.info.height],changedPixels:changed,changedBounds:{left:minX,top:minY,right:maxX,bottom:maxY},unchangedNeckPixels:neckChanges===0,unchangedFacePixels:faceChanges===0,neckToHeadRatio:.8,closedOpeningProbe:{point:[330,530],openAlpha:0,closedAlpha:255},alphaBorders:[],previewReview:'pending'};
  for(const file of files){
    const {data,info}=await sharp(read(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let border=0;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if((x===0||y===0||x===info.width-1||y===info.height-1)&&data[(y*info.width+x)*4+3])border++;
    if(border)throw Error('Nontransparent border '+file);verification.alphaBorders.push({file,width:info.width,height:info.height,nonzeroBorderPixels:border});
  }
  json('previews/art-assets/snake-head-closed-verification-v1.json',verification);
  let comparison='<rect width="1400" height="690" fill="#F8F5EF"/>'+label(45,65,'蛋挞蛇头 · 张嘴 / 闭嘴',32)+label(45,110,'沿用同一原图，颈部、表情与锚点一致',21);
  comparison+=image(40,150,620,487.143,original)+image(740,150,620,487.143,closed)+label(290,665,'张嘴',22)+label(990,665,'闭嘴',22);
  const board='<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="690" viewBox="0 0 1400 690">'+comparison+'</svg>';
  write('previews/art-assets/snake-head-open-closed-v1.svg',board);await sharp(Buffer.from(board)).png().toFile(abs('previews/art-assets/snake-head-open-closed-v1.png'));
  const manifest=JSON.parse(read('assets/asset-manifest-v5.json'));manifest.version=6;
  for(const file of files){const m=await sharp(read(file)).metadata();manifest.primaryAssets.push({path:file,width:m.width,height:m.height,alpha:!!m.hasAlpha,format:m.format,role:'closed-mouth snake head state'});}
  manifest.supportingFiles.push(sourceFile,'assets/snake/head/head-states-v1.json','assets/snake/head/README-head-closed-v1.md','art-tools/export-head-closed-v1.cjs','previews/art-assets/snake-head-closed-verification-v1.json');
  manifest.previewFiles.unshift('previews/art-assets/snake-head-open-closed-v1.png');manifest.currentHead.states='assets/snake/head/head-states-v1.json';
  json('assets/asset-manifest-v6.json',manifest);
  console.log(JSON.stringify({mouthOnly:true,neckChanges,faceChanges,changedBounds:verification.changedBounds,neckRatio:.8,files:files.length,metadata:'assets/snake/head/head-states-v1.json'},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
