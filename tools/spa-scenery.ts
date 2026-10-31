import * as THREE from 'three';
import { Track } from '../src/track';
import { TRACKS } from '../src/trackData';
import { loadNativeCircuit } from '../src/nativeCircuit';
import { CarVisual } from '../src/car';
import { spaFrame } from '../src/spaScenery';

const error=document.querySelector<HTMLElement>('#error')!;
addEventListener('error',e=>{error.textContent=e.message;});
addEventListener('unhandledrejection',e=>{error.textContent=String(e.reason);});
const scene=new THREE.Scene(),car=new CarVisual();scene.add(car.group);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
document.querySelector('#scene')!.append(renderer.domElement);
const view=document.querySelector<HTMLSelectElement>('#view')!,size=document.querySelector<HTMLSelectElement>('#size')!;
const slider=document.querySelector<HTMLInputElement>('#distance')!,status=document.querySelector<HTMLElement>('#status')!;
const play=document.querySelector<HTMLButtonElement>('#play')!;
const loaded=performance.now();await loadNativeCircuit('spa');
let track=new Track(scene,TRACKS.find(t=>t.id==='spa')!);
const preparation=performance.now()-loaded;
const overview=new THREE.PerspectiveCamera(48,16/9,1,10000);
overview.position.set(1250,1900,800);overview.lookAt(-290,0,-850);
let playing=false,distance=0,last=0,reporting=false,replayTravel=0;
const intervals:number[]=[],metrics:{distance:number;calls:number;triangles:number;geometries:number;textures:number}[]=[];
function draw(){
  const [w,h]=size.value.split(',').map(Number);
  if(renderer.domElement.width!==w||renderer.domElement.height!==h){
    renderer.setSize(w,h);car.camera.aspect=w/h;car.camera.updateProjectionMatrix();overview.aspect=w/h;overview.updateProjectionMatrix();
  }
  const p=spaFrame(track,distance),s=track.surfaceAt(p.x,p.z,distance/track.length);
  car.setPose(p.x,p.z,p.yaw,s.height,s.gradientX,s.gradientZ);
  car.group.visible=view.value!=='overview';
  const fog=scene.fog;if(view.value==='overview')scene.fog=null;
  renderer.render(scene,view.value==='overview'?overview:car.camera);
  scene.fog=fog;
}
function summary(){
  const sorted=[...intervals].sort((a,b)=>a-b),at=(q:number)=>sorted[Math.floor((sorted.length-1)*q)]??0;
  return {renderSize:size.value,replayedMetres:Math.round(replayTravel),samples:sorted.length,p50:at(.5),p95:at(.95),preparationMs:preparation,maxCalls:Math.max(0,...metrics.map(m=>m.calls)),maxTriangles:Math.max(0,...metrics.map(m=>m.triangles))};
}
view.onchange=()=>{playing=false;play.textContent='一周を再生';if(view.value!=='overview')distance=Number(view.value);slider.value=String(distance);draw();};
slider.oninput=()=>{view.value='';distance=Number(slider.value);draw();};size.onchange=()=>{intervals.length=0;metrics.length=0;draw();};
play.onclick=()=>{playing=!playing;view.value='';play.textContent=playing?'再生を停止':'一周を再生';if(playing){distance=0;replayTravel=0;intervals.length=0;metrics.length=0;}};
let lastStatus=0;
renderer.setAnimationLoop(now=>{
  if(reporting)return;
  const delta=last?now-last:0;last=now;
  if(playing){
    const step=Math.min(delta,50)*.08333;replayTravel+=step;distance=(distance+step)%track.length;slider.value=String(Math.floor(distance));
    if(replayTravel>=track.length){playing=false;play.textContent='一周を再生';}
  }
  draw();
  if(playing&&delta>0&&delta<250){intervals.push(delta);metrics.push({distance,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,...renderer.info.memory});}
  if(now-lastStatus>500){
    const m=summary();status.textContent=`${distance.toFixed(0)} m / 7004 m · ${renderer.info.render.calls} draws · ${renderer.info.render.triangles.toLocaleString()} triangles · 準備 ${preparation.toFixed(0)} ms · ${m.samples} frames: p50 ${m.p50.toFixed(1)} / p95 ${m.p95.toFixed(1)} ms · ${renderer.info.memory.geometries} geometries / ${renderer.info.memory.textures} textures`;lastStatus=now;
  }
});
document.querySelector<HTMLButtonElement>('#report')!.onclick=async()=>{
  reporting=true;const saved={size:size.value,view:view.value,distance};
  const m=summary(),shots:string[]=[],memory:typeof renderer.info.memory[]=[];
  try{
    for(const resolution of ['1600,900','844,390'])for(const [name,d] of [['ホームストレート',0],['エンデュランス',520],['オー・ルージュ',820],['ラディオン',1050],['ケメル',1650],['プーオン',3600],['ブランシモン',5950],['シケイン',6520],['全景',-1]] as const){
      size.value=resolution;view.value=d<0?'overview':'';distance=Math.max(0,d);draw();
      shots.push(`<figure><figcaption>${name} / ${resolution} / ${renderer.info.render.calls} draws</figcaption><img src="${renderer.domElement.toDataURL('image/jpeg',.8)}"></figure>`);
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    }
    for(let cycle=0;cycle<3;cycle++){
      track.dispose();track=new Track(scene,TRACKS.find(t=>t.id==='spa')!);draw();memory.push({...renderer.info.memory});
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    }
    const html=`<!doctype html><meta charset="utf-8"><title>Formula Q / Spa review</title><style>body{max-width:1200px;margin:32px auto;background:#142126;color:#e5edec;font:16px system-ui}img{width:100%}figure{margin:24px 0}pre{white-space:pre-wrap}</style><h1>Formula Q / Spa scenery review</h1><p>${new Date().toISOString()} / ${navigator.userAgent}</p><p>Public-source approximation. CPU frame intervals include browser scheduling; this is not an iPhone GPU/thermal measurement.</p><pre>${JSON.stringify({performance:m,courseReloadMemory:memory},null,2)}</pre>${shots.join('')}`;
    const url=URL.createObjectURL(new Blob([html],{type:'text/html'})),a=document.createElement('a');a.href=url;a.download='formula-q-spa-review.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }finally{size.value=saved.size;view.value=saved.view;distance=saved.distance;reporting=false;last=0;draw();}
};
draw();
