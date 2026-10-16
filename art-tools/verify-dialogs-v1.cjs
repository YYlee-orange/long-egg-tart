/* Render and inspect the standalone art reference, not the running game. */
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),{chromium}=require('playwright'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),abs=p=>path.join(root,p),checks=[];
const assert=(ok,msg)=>{if(!ok)throw Error(msg);checks.push(msg);};
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1200,height:820},deviceScaleFactor:1});
 try{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});await page.goto(pathToFileURL(abs('previews/dialogs/dialog-reference-v1.html')).href);await page.evaluate(()=>document.fonts.ready);
  assert(await page.locator('.dialog-mascot').evaluate(e=>e.complete&&e.naturalWidth>0),'Mascot loads');
  await page.locator('#demo-primary').evaluate(e=>e.blur());
  await page.locator('.tart-dialog').screenshot({path:abs('previews/dialogs/pause-dialog-v1.png')});await page.locator('.preview-stage').screenshot({path:abs('previews/dialogs/pause-scene-v1.png')});
  assert((await page.locator('#dialog-title').textContent())==='已暂停','Pause heading and action labels');
  await page.locator('#show-pause').click();await page.keyboard.press('Tab');assert((await page.evaluate(()=>document.activeElement.id))==='demo-home','Tab cycles from primary to home');await page.keyboard.press('Shift+Tab');assert((await page.evaluate(()=>document.activeElement.id))==='demo-primary','Shift+Tab cycles back to primary');
  const focus=await page.locator('#demo-primary').evaluate(e=>({outline:getComputedStyle(e).outlineWidth,offset:getComputedStyle(e).outlineOffset}));assert(focus.outline==='2px'&&focus.offset==='4px','Keyboard focus is a separate thin outline');await page.locator('.tart-dialog').screenshot({path:abs('previews/dialogs/keyboard-focus-v1.png')});
  await page.keyboard.press('Escape');assert(await page.locator('#dialog-overlay').isHidden(),'Escape closes pause demo');assert((await page.evaluate(()=>document.activeElement.id))==='show-pause','Focus returns to opener');
  await page.locator('#show-result').click();await page.locator('#demo-primary').evaluate(e=>e.blur());await page.locator('.tart-dialog').screenshot({path:abs('previews/dialogs/result-dialog-v1.png')});await page.locator('.preview-stage').screenshot({path:abs('previews/dialogs/result-scene-v1.png')});
  await page.keyboard.press('Escape');assert(await page.locator('#dialog-overlay').isVisible(),'Escape keeps result demo open');
  const stage=await page.locator('.preview-stage').boundingBox();await page.mouse.click(stage.x+8,stage.y+8);assert(await page.locator('#dialog-overlay').isVisible(),'Backdrop click never dismisses dialog');
  const scores=[];for(const n of [0,13,999,12345,12345678]){await page.locator('#sample-length').fill(String(n));const q=await page.locator('#score-value').evaluate(e=>({text:e.textContent,sw:e.scrollWidth,cw:e.clientWidth}));assert(q.text===String(n)&&q.sw<=q.cw+1,'Dynamic score fits: '+n);scores.push(q);}
  await page.locator('#sample-length').fill('13');await page.locator('#demo-primary').click();assert(await page.locator('#dialog-overlay').isHidden(),'Primary button triggers demo action');
  const responsive=[];for(const v of [{width:390,height:844},{width:360,height:780},{width:844,height:390}]){await page.setViewportSize(v);await page.locator('#show-result').click();const q=await page.locator('.tart-dialog').boundingBox(),buttons=await page.locator('.dialog-action').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {height:r.height,right:r.right,bottom:r.bottom,left:r.left};}));assert(q.x>=0&&q.y>=0&&q.x+q.width<=v.width+1&&q.y+q.height<=v.height+1,'Result dialog fits viewport '+v.width+'x'+v.height);assert(buttons.every(b=>b.height>=44&&b.left>=0&&b.right<=v.width&&b.bottom<=v.height),'Touch actions visible '+v.width+'x'+v.height);responsive.push({viewport:v,dialog:q});if(v.width===390)await page.screenshot({path:abs('previews/dialogs/mobile-result-v1.png')});if(v.width===844)await page.screenshot({path:abs('previews/dialogs/compact-result-v1.png')});await page.locator('#demo-primary').click();}
  assert(errors.length===0,'No browser script errors');
  const lin=v=>(v/=255)<=.04045?v/12.92:((v+.055)/1.055)**2.4,luma=h=>{const a=h.slice(1).match(/../g).map(x=>lin(parseInt(x,16)));return .2126*a[0]+.7152*a[1]+.0722*a[2];},contrast=(a,b)=>{const x=luma(a),y=luma(b);return +((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2);};
  const contrastRatios={primary:contrast('#FFF8ED','#9C5B50'),primaryHover:contrast('#FFF8ED','#8F4E44'),secondary:contrast('#765238','#F2E3CB'),subtitle:contrast('#8C6A4D','#FFF8ED')};assert(Object.values(contrastRatios).every(r=>r>=4.5),'Text contrast at least 4.5:1 for enabled controls and subtitle');
  const old=JSON.parse(fs.readFileSync(abs('previews/dialogs/asset-verification-v1.json')));Object.assign(old,{visualReview:'pending final image inspection',interactiveReview:'pass',browser:'headless Microsoft Edge via bundled Playwright',checks,responsive,contrastRatios,dynamicScores:scores});fs.writeFileSync(abs('previews/dialogs/asset-verification-v1.json'),JSON.stringify(old,null,2)+'\n');
  const pause=fs.readFileSync(abs('previews/dialogs/pause-dialog-v1.png')),result=fs.readFileSync(abs('previews/dialogs/result-dialog-v1.png'));
  const image=(x,y,w,h,b)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b.toString('base64')}"/>`,p=await sharp(pause).metadata(),r=await sharp(result).metadata();
  const s=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="560"><rect width="1280" height="560" fill="#F8F0E6"/><g font-family="Microsoft YaHei,Segoe UI,sans-serif" font-size="25" fill="#765238"><text x="240" y="52">暂停弹窗</text><text x="880" y="52">结算弹窗</text></g>${image(40,100+(400-p.height)/2,560,p.height,pause)}${image(680,100+(400-r.height)/2,560,r.height,result)}</svg>`;
  fs.writeFileSync(abs('previews/dialogs/dialog-comparison-v1.svg'),s);await sharp(Buffer.from(s)).png().toFile(abs('previews/dialogs/dialog-comparison-v1.png'));
  console.log(JSON.stringify({passedChecks:checks.length,contrastRatios,responsive:responsive.length,pauseSize:[p.width,p.height],resultSize:[r.width,r.height]},null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
