/* Offline art mastering only. Exact one-cell gingham and lace; no game changes. */
const fs = require('fs'), path = require('path'), sharp = require('sharp'), crypto = require('crypto');
const root = path.resolve(__dirname, '..'), abs = p => path.join(root, p);
const read = p => fs.readFileSync(abs(p)), write = (p, v) => fs.writeFileSync(abs(p), v);
const json = (p, o) => write(p, JSON.stringify(o, null, 2) + '\n');
const W = 1920, H = 1056, C = 96;
const colors = {cream:'#F3E7DD',stripe:'#E2B7B2',overlap:'#C98F94',border:'#F8F0E6',lace:'#FFFAF3',cutout:'#E8D6D0'};
const rect = (x,y,w,h,fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const image = (x,y,w,h,b) => `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`;
const svg = (w,h,b) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${b}</svg>`;
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
async function emit(p, w, h, b, opaque=false) {
  const s=svg(w,h,b); write(p+'.svg',s);
  let out=sharp(Buffer.from(s)); if(opaque) out=out.removeAlpha();
  await out.png().toFile(abs(p+'.png')); return s;
}
function flowerDefinition() {
  let s='<g id="lace-flower">';
  s+=`<circle r="30" fill="${colors.lace}"/>`;
  for(let i=0;i<8;i++) { const a=i*Math.PI/4; s+=`<circle cx="${(24*Math.cos(a)).toFixed(3)}" cy="${(24*Math.sin(a)).toFixed(3)}" r="18" fill="${colors.lace}"/>`; }
  for(let i=0;i<5;i++) s+=`<path d="M 0 -6 C -5 -9 -8 -18 -6 -23 C -4 -28 3 -28 6 -23 C 9 -17 5 -9 0 -6 Z" transform="rotate(${i*72})" fill="${colors.cutout}"/>`;
  return s+`<circle r="3" fill="${colors.cutout}"/></g>`;
}
async function main() {
  const cells=[]; let b=`<defs>${flowerDefinition()}</defs>`+rect(0,0,W,H,colors.border);
  // Lace is contained entirely within the reserved outer ring.
  b+=rect(0,24,W,48,colors.lace)+rect(0,H-72,W,48,colors.lace);
  b+=rect(24,0,48,H,colors.lace)+rect(W-72,0,48,H,colors.lace);
  for(let row=0;row<11;row++) for(let col=0;col<20;col++) {
    const x=col*C,y=row*C;
    if(row===0||row===10||col===0||col===19) {
      b+=`<use href="#lace-flower" transform="translate(${x+48} ${y+48})"/>`;
    } else {
      const fill=(col%2===1&&row%2===1)?colors.cream:(col%2===0&&row%2===0)?colors.overlap:colors.stripe;
      cells.push({column:col,row,x,y,width:C,height:C,fill}); b+=rect(x,y,C,C,fill);
    }
  }
  const source='assets/backgrounds/source/picnic-cloth-flat-v1';
  await emit(source,W,H,b,true);
  const background='assets/backgrounds/picnic-cloth-flat-v1.png'; fs.copyFileSync(abs(source+'.png'),abs(background));
  await sharp(read(background)).resize(960,528).removeAlpha().png().toFile(abs('assets/backgrounds/picnic-cloth-flat-960-v1.png'));
  const layout={version:1,canvas:{width:W,height:H,columns:20,rows:11,cellPixels:C},border:{cells:1,pixels:C,sides:['top','right','bottom','left'],decoration:'one simple scalloped white flower per boundary cell; no outlines'},interior:{x:C,y:C,width:18*C,height:9*C,columns:18,rows:9},weave:{horizontalBandPixels:C,verticalBandPixels:C,bandCells:1,outlines:false,gradients:false,texture:false},colors,cells,source:source+'.svg',background};
  json('assets/backgrounds/picnic-cloth-layout-v1.json',layout);
  let snake=read('previews/art-assets/snake-head-connection-v7.svg').toString().replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').replace(/<image x="0" y="0" width="1120" height="600" href="data:image\/png;base64,[^"]+"\/>/,'');
  const food='assets/food/custard-carton-outline-128-v7.png';
  const scene=image(0,0,W,H,read(background))+`<g transform="translate(288 192)">${snake}</g>`+image(1536,384,96,96,read(food));
  await emit('previews/art-assets/art-style-scene-v9',W,H,scene,true);
  await sharp(read('previews/art-assets/art-style-scene-v9.png')).resize(960,528).png().toFile(abs('previews/art-assets/picnic-game-scale-v1.png'));
  const manifest=JSON.parse(read('assets/asset-manifest-v8.json')); manifest.version=9;
  Object.assign(manifest.primaryAssets.find(a=>a.path.startsWith('assets/backgrounds/')),{path:background,width:W,height:H,alpha:false,role:'top-down picnic cloth game-map background'});
  manifest.primaryAssets.push({path:'assets/backgrounds/picnic-cloth-flat-960-v1.png',width:960,height:528,alpha:false,format:'png',role:'logical game-map-size background'});
  manifest.supportingFiles.push(source+'.svg',source+'.png','assets/backgrounds/picnic-cloth-layout-v1.json','assets/backgrounds/source/user-picnic-reference-v1.png','assets/backgrounds/source/picnic-cloth-generated-study-v1.png','assets/backgrounds/source/picnic-cloth-generated-study-v2.png','art-tools/export-picnic-cloth-v1.cjs','assets/README-art-style-v9.md','previews/art-assets/picnic-cloth-prompts-v1.md','previews/art-assets/art-style-verification-v9.json');
  manifest.previewFiles.unshift('previews/art-assets/art-style-scene-v9.png','previews/art-assets/picnic-game-scale-v1.png');
  manifest.revision={backgroundVersion:1,backgroundStyle:'Soft flat red/cream gingham picnic cloth with white scalloped flower border',backgroundLayout:'20x11 cells; outer one-cell ring; 18x9 interior; horizontal and vertical bands each one cell',foodVersion:7,foodOutlineTrial:true,foodBase:'assets/food/custard-carton-approved-v6.png',policy:'Picnic cloth supersedes wood. User correction sets both weave bands to ONE cell. Preserve previous drafts and all character assets.'};
  manifest.archivedDrafts='All wood backgrounds, generated picnic studies and previous manifests remain. Current background is picnic-cloth-flat-v1; character and food files unchanged.';
  json('assets/asset-manifest-v9.json',manifest);
  const {data,info}=await sharp(read(background)).raw().toBuffer({resolveWithObject:true});
  let bad=0; const runs=[];
  for(let row=1;row<10;row++)for(let col=1;col<19;col++){
    const cell=cells.find(q=>q.column===col&&q.row===row),target=cell.fill.slice(1).match(/../g).map(v=>parseInt(v,16));
    for(let y=cell.y;y<cell.y+C;y++)for(let x=cell.x;x<cell.x+C;x++) {const o=(y*info.width+x)*info.channels;if(target.some((v,k)=>data[o+k]!==v))bad++;}
  }
  if(bad)throw Error(`Interior has ${bad} non-flat or misaligned pixels.`);
  const hsvSat=h=>{const a=h.slice(1).match(/../g).map(v=>parseInt(v,16)),m=Math.max(...a);return +((m-Math.min(...a))/m).toFixed(4);};
  const palette=Object.fromEntries(Object.entries(colors).map(([k,v])=>[k,{hex:v,hsvSaturation:hsvSat(v)}]));
  const prior=JSON.parse(read('assets/asset-manifest-v8.json')).primaryAssets.filter(a=>!a.path.startsWith('assets/backgrounds/'));
  const foreground=prior.map(a=>({path:a.path,sha256:hash(read(a.path)),unchangedReference:a.path}));
  json('previews/art-assets/art-style-verification-v9.json',{version:9,background:{path:background,width:W,height:H,alpha:false,sha256:hash(read(background))},layout:{cellPixels:C,borderPixels:C,interiorColumns:18,interiorRows:9,interiorCellCount:cells.length,bandPixels:C,nonFlatInteriorPixels:bad},palette,characterCustard:{hex:'#F3D994',hsvSaturation:hsvSat('#F3D994')},foreground,scope:'art assets and offline preview only',visualReview:'pending'});
  console.log(JSON.stringify({background,dimensions:[W,H],cellPixels:C,borderPixels:C,interior:[18,9],bandPixels:C,nonFlatInteriorPixels:bad,foregroundFiles:foreground.length},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
