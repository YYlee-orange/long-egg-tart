/** Offline art geometry only. No game loop, UI, input, collision or scene code. */
export const PALETTE = Object.freeze({crust:'#C38C55',rim:'#DDB575',custard:'#F3D994',bakeLight:'#D5AE68',bakeMedium:'#CE9C57',bakeDark:'#BE824A',pastryLine:'#A97545'});
export const STRUCTURE = Object.freeze({width:64,rimWidth:52,fillWidth:42,turnRadius:56,minTurnRadius:48});
const EPS=1e-7, PI=Math.PI;
const dist=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const fmt=n=>Number(n.toFixed(4));
const pointString=p=>p.map(fmt).join(' ');
function line(a,b){return {kind:'line',a:[...a],b:[...b],length:dist(a,b)};}
function arc(c,r,theta,delta){
  const at=t=>[c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)];
  return {kind:'arc',c:[...c],r,theta,delta,a:at(theta),b:at(theta+delta),length:Math.abs(delta)*r};
}
export function makePath(primitives){
  const parts=primitives.filter(p=>p.length>EPS);let length=0;
  for(const p of parts){p.start=length;length+=p.length;}
  let d=parts.length?'M '+pointString(parts[0].a):'';
  for(const p of parts)d+=p.kind==='line'?' L '+pointString(p.b):` A ${fmt(p.r)} ${fmt(p.r)} 0 ${Math.abs(p.delta)>PI?1:0} ${p.delta>0?1:0} ${pointString(p.b)}`;
  return {parts,length,d};
}
export function roundOrthogonal(points,r=STRUCTURE.turnRadius){
  if(points.length<2||r<=0)throw Error('A path needs two points and a positive radius.');
  const incoming=[],outgoing=[];
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],len=dist(a,b);
    if(len<EPS||(Math.abs(a[0]-b[0])>EPS&&Math.abs(a[1]-b[1])>EPS))throw Error('Reference paths must be orthogonal, without duplicate vertices.');
    const need=(i>0?r:0)+(i<points.length-2?r:0);
    if(len+EPS<need)throw Error('Adjacent corner trims overlap; increase segment length or reduce radius.');
    const u=[(b[0]-a[0])/len,(b[1]-a[1])/len];outgoing[i]=u;incoming[i+1]=u;
  }
  const parts=[];let cursor=points[0];
  for(let i=1;i<points.length-1;i++){
    const v=points[i],u=incoming[i],w=outgoing[i];
    const cross=u[0]*w[1]-u[1]*w[0];
    if(Math.abs(cross)<0.5)throw Error('Every internal vertex must be a quarter turn; remove collinear vertices.');
    const a=[v[0]-u[0]*r,v[1]-u[1]*r],b=[v[0]+w[0]*r,v[1]+w[1]*r];
    const c=[a[0]+w[0]*r,a[1]+w[1]*r];
    parts.push(line(cursor,a),arc(c,r,Math.atan2(a[1]-c[1],a[0]-c[0]),Math.sign(cross)*PI/2));cursor=b;
  }
  parts.push(line(cursor,points.at(-1)));return makePath(parts);
}
export function at(path,s){
  s=Math.max(0,Math.min(path.length,s));
  const p=path.parts.find(q=>s<=q.start+q.length+EPS)||path.parts.at(-1);
  const t=Math.max(0,Math.min(1,(s-p.start)/p.length));
  if(p.kind==='line'){
    const tangent=[(p.b[0]-p.a[0])/p.length,(p.b[1]-p.a[1])/p.length];
    return {p:[p.a[0]+(p.b[0]-p.a[0])*t,p.a[1]+(p.b[1]-p.a[1])*t],t:tangent,n:[-tangent[1],tangent[0]]};
  }
  const angle=p.theta+p.delta*t,sign=Math.sign(p.delta),tangent=[-Math.sin(angle)*sign,Math.cos(angle)*sign];
  return {p:[p.c[0]+p.r*Math.cos(angle),p.c[1]+p.r*Math.sin(angle)],t:tangent,n:[-tangent[1],tangent[0]]};
}
export function slicePath(path,from=0,to=path.length){
  from=Math.max(0,from);to=Math.min(path.length,to);const parts=[];
  for(const p of path.parts){
    const a=Math.max(from,p.start),b=Math.min(to,p.start+p.length);if(b-a<=EPS)continue;
    const t0=(a-p.start)/p.length,t1=(b-p.start)/p.length;
    parts.push(p.kind==='line'?line(at(path,a).p,at(path,b).p):arc(p.c,p.r,p.theta+p.delta*t0,p.delta*(t1-t0)));
  }
  return makePath(parts);
}
export function reversePath(path){
  return makePath([...path.parts].reverse().map(p=>p.kind==='line'?line(p.b,p.a):arc(p.c,p.r,p.theta+p.delta,-p.delta)));
}
function hash(x){x=(x^61)^(x>>>16);x=Math.imul(x,9);x^=x>>>4;x=Math.imul(x,0x27d4eb2d);x^=x>>>15;return x>>>0;}
export function materialRecords(maxLength,width=64,seed=20261016){
  const out=[];let m=0.36*width,prev=-1,before=-1;
  for(let id=0;m<maxLength+width;id++){
    const rnd=k=>hash(seed^Math.imul(id+1,374761393)^Math.imul(k+1,668265263))/4294967296;
    let variant=Math.floor(rnd(0)*12);while(variant===prev||variant===before)variant=(variant+5)%12;
    out.push({id:`bake-${id}`,kind:'bake',variant,m:fmt(m),lateral:fmt((rnd(1)-0.5)*0.24*width),length:fmt((0.19+rnd(2)*0.14)*width),breadth:fmt((0.13+rnd(3)*0.09)*width),angle:fmt((rnd(4)-0.5)*0.54)});
    before=prev;prev=variant;m+=(0.67+rnd(5)*0.31)*width;
  }
  m=0.92*width;
  for(let id=0;m<maxLength+width;id++){
    const q=hash(seed+id*1171+99831)/4294967296;
    out.push({id:`pastry-${id}`,kind:'pastry',variant:12+id%4,m:fmt(m),lateral:fmt((id%2?1:-1)*0.451*width),length:fmt((0.30+q*0.09)*width),breadth:fmt(0.070*width),angle:0});
    m+=(2.2+q*1.1)*width;
  }
  return out;
}
function mappedContour(contour,record,shape,path){
  const b=shape.bounds,center=[b.x+b.width/2,b.y+b.height/2],ca=Math.cos(record.angle),sa=Math.sin(record.angle);
  const points=contour.map(p=>{
    const u=(p[0]-center[0])/b.width*record.length,v=(p[1]-center[1])/b.height*record.breadth;
    const along=u*ca-v*sa,offset=record.lateral+u*sa+v*ca;
    const q=at(path,record.m+along);return [q.p[0]+q.n[0]*offset,q.p[1]+q.n[1]*offset];
  });
  return 'M '+points.map(pointString).join(' L ')+' Z';
}
export function bodyMarkup(path,shapes,records,{width=64,visibleLength=path.length,prefix='body',textures=true}={}){
  const visible=slicePath(path,0,visibleLength),rim=width*52/64,fill=width*42/64;
  const stroke=(w,color)=>`<path d="${visible.d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const defs=`<defs><mask id="${prefix}-fill" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="8000" height="8000">${stroke(fill,'white')}</mask><mask id="${prefix}-crust" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="8000" height="8000">${stroke(width,'white')}${stroke(rim,'black')}</mask></defs>`;
  let bake='',pastry='';
  if(textures)for(const r of records){
    if(r.m-r.length>visible.length||r.m+r.length<0)continue;
    const shape=shapes[r.variant];
    const d=shape.contours.map(c=>mappedContour(c,r,shape,path)).join(' ');
    const element=`<path d="${d}" fill="${shape.color}"/>`;
    if(r.kind==='bake')bake+=element;else pastry+=element;
  }
  return defs+stroke(width,PALETTE.crust)+stroke(rim,PALETTE.rim)+stroke(fill,PALETTE.custard)+`<g mask="url(#${prefix}-fill)">${bake}</g><g mask="url(#${prefix}-crust)">${pastry}</g>`;
}
export function verifyGeometry(path,width=64){
  let maxGap=0,maxTangentError=0;
  for(let i=0;i<path.parts.length-1;i++){
    const a=path.parts[i],b=path.parts[i+1];maxGap=Math.max(maxGap,dist(a.b,b.a));
    const qa=at(makePath([structuredClone(a)]),a.length),qb=at(makePath([structuredClone(b)]),0);
    maxTangentError=Math.max(maxTangentError,Math.hypot(qa.t[0]-qb.t[0],qa.t[1]-qb.t[1]));
  }
  const minRadius=Math.min(...path.parts.filter(p=>p.kind==='arc').map(p=>p.r));
  if(maxGap>1e-5||maxTangentError>1e-5||minRadius<=width/2)throw Error('Geometry continuity failed.');
  return {maxGap,maxTangentError,minimumCenterRadius:Number.isFinite(minRadius)?minRadius:null,outerWidth:width,crustThickness:width*6/64,innerRimThickness:width*5/64,fillWidth:width*42/64};
}

