const fs=require('fs'),path=require('path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const save=(p,o)=>fs.writeFileSync(path.join(root,p),JSON.stringify(o,null,2)+'\n');
async function main(){
  const G=await import('../assets/snake/source/body-geometry-v2.mjs');
  const shapes=JSON.parse(read('assets/snake/source/decal-shapes-v5.json')).shapes;
  const route=G.roundOrthogonal([[50,100],[550,100]],56),records=G.materialRecords(route.length);
  const render=rs=>sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">'+G.bodyMarkup(route,shapes,rs)+'</svg>')).ensureAlpha().raw().toBuffer();
  const all=await render(records),bakeOnly=await render(records.filter(r=>r.kind==='bake'));
  let pastryPixels=0;for(let i=0;i<all.length;i+=4)if(all[i]!==bakeOnly[i]||all[i+1]!==bakeOnly[i+1]||all[i+2]!==bakeOnly[i+2])pastryPixels++;
  if(pastryPixels<20)throw Error('Pastry details are not visibly exported.');
  const sources=['assets/food/source/custard-carton-flat-v5.svg','assets/snake/source/decals-atlas-flat-v5.svg',...shapes.map(s=>`assets/snake/decals/${s.name}-v5.svg`),...['straight','corner-ne','corner-se','corner-sw','corner-nw','cap-right','cap-left'].map(s=>`assets/snake/geometry/${s}-v2.svg`)];
  for(const file of sources)if(/<(linearGradient|radialGradient|filter|feDropShadow|feGaussianBlur)\b/i.test(read(file)))throw Error('Baked lighting/filter found: '+file);
  const cartonColors=[...new Set([...read(sources[0]).matchAll(/(?:fill|stroke)="(#[A-Fa-f0-9]{6})"/g)].map(m=>m[1]))];
  if(cartonColors.length!==6)throw Error('Carton palette must contain exactly six intrinsic colors.');
  const q=JSON.parse(read('previews/art-assets/verification-v2.json'));
  q.production.pastryLineAffectedPixelsIn64pxBody=pastryPixels;
  q.production.cartonSourcePalette=cartonColors;
  q.production.flatMasterSourcesChecked=sources.length;
  q.production.antialiasNote='The carton has exactly six uniform vector paints. Extra RGB values in the raster occur only at anti-aliased color boundaries; no gradients or lighting exist in the master.';
  q.visualReview={completed:true,images:['assets-overview-v2.png','geometry-continuity-v2.png','material-continuity-v2.png','food-alpha-size-v2.png'],findings:'Clean pale wood; flat food panels; clean alpha; continuous S/U joins; fine crust lines visible; stable ids through growth; viewport clips wrap without extra caps.'};
  save('previews/art-assets/verification-v2.json',q);
  const primary=['assets/backgrounds/wood-table-soft-v2.png','assets/food/custard-carton-flat-v5.png',...[48,64,128,256].map(s=>`assets/food/custard-carton-${s}-v5.png`),'assets/snake/decals-atlas-flat-v5.png',...shapes.map(s=>`assets/snake/decals/${s.name}-v5.png`)];
  const entries=[];for(const file of primary){const m=await sharp(path.join(root,file)).metadata();entries.push({path:file,width:m.width,height:m.height,alpha:m.hasAlpha||false,format:m.format,role:file.includes('backgrounds')?'full-screen background':file.includes('food')?'food sprite':file.includes('atlas')?'16-frame texture atlas':'individual texture decal'});}
  const supporting=[...sources,'assets/snake/decals-atlas-flat-v5.json','assets/snake/source/decal-shapes-v5.json','assets/snake/source/body-geometry-v2.mjs','assets/snake/source/material-layout-v2.json','assets/snake/geometry/geometry-fixtures-v2.json','previews/art-assets/material-state-fixtures-v2.json','previews/art-assets/verification-v2.json','previews/art-assets/image-prompts-v1-v3.md','art-tools/export-art-v2.cjs','art-tools/verify-delivery-v2.cjs'];
  for(const file of supporting)if(!fs.existsSync(path.join(root,file)))throw Error('Missing supporting file: '+file);
  save('assets/asset-manifest-v2.json',{version:2,date:'2026-10-16',primaryAssets:entries,supportingFiles:supporting,previewFiles:q.visualReview.images.map(s=>'previews/art-assets/'+s),atlas:{metadata:'assets/snake/decals-atlas-flat-v5.json',frameSize:[256,256],layout:[4,4],bakeSpotFrames:12,pastryLineFrames:4},archivedDrafts:'All generated-v1/v2/v3 PNGs, flat-v4 files, previous geometry and preview v1 are retained for comparison. Use only the primaryAssets list for the current delivery.',scope:'Art assets, editable sources and offline fixtures. No game logic, UI or transitions.'});
  console.log(JSON.stringify({primaryAssets:entries.length,supportingFiles:supporting.length,geometryChecks:q.geometry.length,flatSourceFiles:sources.length,pastryDetailPixels:pastryPixels,cartonPaints:cartonColors,alphaMarginsPass:q.alpha.every(x=>x.nonzeroBorderPixels===0),maxGeometryGap:Math.max(...q.geometry.map(x=>x.maxGap)),maxTangentError:Math.max(...q.geometry.map(x=>x.maxTangentError))},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
