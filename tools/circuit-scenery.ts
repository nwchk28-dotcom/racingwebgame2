import * as THREE from 'three';
import { Track } from '../src/track';
import { TRACKS } from '../src/trackData';
import { loadNativeCircuit } from '../src/nativeCircuit';
import { CarVisual } from '../src/car';
import { sceneryFrame, type PlacedFacility } from '../src/sceneryBuilder';
import { CIRCUIT_SCENERY } from '../src/circuitSceneryProfiles';

const error=document.querySelector<HTMLElement>('#error')!;
addEventListener('error',e=>{error.textContent=e.message;});
addEventListener('unhandledrejection',e=>{error.textContent=String(e.reason);});
const scene=new THREE.Scene(),car=new CarVisual();scene.add(car.group);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
document.querySelector('#scene')!.append(renderer.domElement);
const course=document.querySelector<HTMLSelectElement>('#course')!,view=document.querySelector<HTMLSelectElement>('#view')!,size=document.querySelector<HTMLSelectElement>('#size')!;
const slider=document.querySelector<HTMLInputElement>('#distance')!,status=document.querySelector<HTMLElement>('#status')!,play=document.querySelector<HTMLButtonElement>('#play')!;
course.replaceChildren(...TRACKS.map(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.name;return o;}));
const inspection=new THREE.PerspectiveCamera(48,16/9,1,10000);
let track:Track,playing=false,loading=false,reporting=false,last=0,lastStatus=0,preparation=0,frames:number[]=[];
async function select(id:string){
  loading=true;const start=performance.now();await loadNativeCircuit(id);
  if(track)track.dispose();track=new Track(scene,TRACKS.find(t=>t.id===id)!);
  preparation=performance.now()-start;course.value=id;loading=false;frames=[];
}
function draw(){
  if(!track||loading)return;
  const [w,h]=size.value.split(',').map(Number);
  if(renderer.domElement.width!==w||renderer.domElement.height!==h){renderer.setSize(w,h);car.camera.aspect=w/h;car.camera.updateProjectionMatrix();inspection.aspect=w/h;inspection.updateProjectionMatrix();}
  const distance=Number(slider.value)/1000*track.length,p=sceneryFrame(track,distance),s=track.surfaceAt(p.x,p.z,distance/track.length);
  car.setPose(p.x,p.z,p.yaw,s.height,s.gradientX,s.gradientZ);car.group.visible=view.value==='onboard';
  const fog=scene.fog;
  if(view.value!=='onboard'){
    scene.fog=null;
    if(view.value==='overview'){
      const bounds=new THREE.Box3().setFromPoints(track.samples),center=bounds.getCenter(new THREE.Vector3()),extent=bounds.getSize(new THREE.Vector3()),r=Math.max(extent.x,extent.z)*.95;
      inspection.position.set(center.x+r*.6,center.y+r*.95,center.z+r*.65);inspection.lookAt(center);
    }else{
      const facilities=track.group.children.find(o=>o.name.endsWith('-scenery'))!.children.filter(o=>o.userData.facility);
      const target=facilities.find(o=>!['pit','stand','water','hill','dune','city'].includes(o.userData.facility.kind))??facilities[0];
      const f=target.userData.facility as PlacedFacility,r=Math.max(f.width,f.length,f.height)*1.6,face=-Math.sign(f.offset);
      const local=new THREE.Vector3(face*r,r*.65,r*.6).applyAxisAngle(new THREE.Vector3(0,1,0),f.yaw);
      inspection.position.copy(target.position).add(local);inspection.lookAt(target.position.clone().add(new THREE.Vector3(0,f.height*.35,0)));
    }
  }
  renderer.render(scene,view.value==='onboard'?car.camera:inspection);scene.fog=fog;
}
course.onchange=async()=>{playing=false;play.textContent='再生';await select(course.value);draw();};
view.onchange=draw;size.onchange=()=>{frames=[];draw();};slider.oninput=draw;
play.onclick=()=>{playing=!playing;view.value='onboard';play.textContent=playing?'停止':'再生';if(playing)frames=[];};
await select(course.value||'monza');draw();
renderer.setAnimationLoop(now=>{
  const dt=last?now-last:0;last=now;if(loading||reporting)return;
  if(playing){slider.value=String((Number(slider.value)+Math.min(dt,50)/track.length*83.33)%1000);if(dt>0&&dt<200)frames.push(dt);}
  draw();
  if(now-lastStatus>500){
    const sorted=[...frames].sort((a,b)=>a-b),p=(q:number)=>sorted[Math.floor((sorted.length-1)*q)]??0;
    status.textContent=`${track.definition.name} · ${renderer.info.render.calls} draws / ${renderer.info.render.triangles.toLocaleString()} triangles · 準備 ${preparation.toFixed(0)} ms · ${frames.length} frames: p50 ${p(.5).toFixed(1)} / p95 ${p(.95).toFixed(1)} ms · ${renderer.info.memory.geometries} geometries / ${renderer.info.memory.textures} textures`;lastStatus=now;
  }
});
document.querySelector<HTMLButtonElement>('#report')!.onclick=async()=>{
  const saved={course:course.value,view:view.value,size:size.value,distance:slider.value};
  playing=false;play.textContent='再生';reporting=true;
  const sections:string[]=[],summary:unknown[]=[];
  try{
    for(const definition of TRACKS){
      status.textContent=`画像を作成中: ${definition.name}`;await select(definition.id);
      const shots:string[]=[],stats:unknown[]=[];
      for(const resolution of ['1280,720','844,390'])for(const mode of ['onboard','landmark','overview']){
        size.value=resolution;view.value=mode;slider.value='980';draw();
        const image=renderer.domElement.toDataURL('image/jpeg',.78);
        stats.push({resolution,mode,draws:renderer.info.render.calls,triangles:renderer.info.render.triangles});
        shots.push(`<figure><figcaption>${mode} / ${resolution}</figcaption><img loading="lazy" src="${image}"></figure>`);
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      }
      const root=track.group.getObjectByName(`${definition.id}-scenery`)!;
      const item={id:definition.id,preparationMs:preparation,trees:root.userData.trees.length,missingFacilities:root.userData.missingFacilities??[],resources:{...renderer.info.memory},views:stats};summary.push(item);
      sections.push(`<section id="${definition.id}"><h2>${definition.name}</h2><p>${(CIRCUIT_SCENERY[definition.id]?.references??[]).map(url=>`<a href="${url}">Reference</a>`).join(' · ')}</p>${shots.join('')}</section>`);
    }
    const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><title>Formula Q / All circuit scenery review</title><style>body{max-width:1200px;margin:30px auto;background:#132126;color:#e5eded;font:16px system-ui}a{color:#9ed4e0}nav{display:flex;flex-wrap:wrap;gap:12px}img{width:100%}figure{margin:18px 0}h2{margin-top:60px}pre{white-space:pre-wrap}</style><h1>Formula Q / コース別景観レビュー</h1><p>${new Date().toISOString()} / ${navigator.userAgent}</p><p>公開資料に基づく軽量3Dの近似。施設・水域の寸法と配置、森林の境界は実測値ではありません。全景・施設確認では霧を外しています。</p><nav>${TRACKS.map(t=>`<a href="#${t.id}">${t.name}</a>`).join('')}</nav><details><summary>描画とリソースの検証データ</summary><pre>${JSON.stringify(summary,null,2)}</pre></details>${sections.join('')}</html>`;
    const url=URL.createObjectURL(new Blob([html],{type:'text/html'})),a=document.createElement('a');a.href=url;a.download='formula-q-all-circuits-review.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }finally{
    await select(saved.course);view.value=saved.view;size.value=saved.size;slider.value=saved.distance;reporting=false;draw();
  }
};
