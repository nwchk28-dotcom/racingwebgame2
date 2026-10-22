// Deterministic replay for inspecting the real renderer/contact/lap code on hills and overpasses.
import * as THREE from 'three';
import { Track } from '../src/track';
import { TRACKS } from '../src/trackData';
import { CarPhysics } from '../src/physics';
import { CarVisual } from '../src/car';
import { loadNativeCircuit } from '../src/nativeCircuit';
import { PoseInterpolator } from '../src/renderPose';
import { LapTracker } from '../src/lap';
const scene=new THREE.Scene(),car=new CarVisual();scene.add(car.group);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
document.body.append(renderer.domElement);
const route=document.querySelector<HTMLSelectElement>('#route')!,offset=document.querySelector<HTMLSelectElement>('#offset')!,status=document.querySelector<HTMLElement>('#status')!;
let track:Track,physics:CarPhysics,pose:PoseInterpolator,laps:LapTracker,distance=0,start=1000,end=1250,last=0,accumulator=0,paused=false,loading=false,maxHeightStep=0,previousHeight=0;
const point=(d:number)=>{
 let lo=0,hi=track.sampleCount;
 while(lo+1<hi){const m=(lo+hi)>>>1;if(track.distances[m]<=d)lo=m;else hi=m;}
 const t=(d-track.distances[lo])/(track.distances[hi]-track.distances[lo]);
 const data=track.native,mix=(a:number,b:number)=>a+(b-a)*t;
 let u=Number(offset.value);
 if(offset.value.endsWith('-edge')){
  const side=offset.value==='left-edge'?1:-1,limit=side>0?data.corridor.left:data.corridor.right;
  const edge=mix(data.widths[lo],data.widths[hi])+data.curbWidth;
  u=side*Math.min(mix(limit[lo],limit[hi])-1.25,edge-.7+Math.sin((d-start)/9)*1.1);
 }
 const p=track.ribbon!.at(lo,t,u);return {x:p.x,z:p.z};
};
function reset(){
 distance=start;const p=point(distance),next=point(distance+.1);
 physics=new CarPhysics(track);
 const lo=track.ribbon!.segmentAt(start/track.length),t=(start-track.distances[lo])/(track.distances[lo+1]-track.distances[lo]),center=track.ribbon!.at(lo,t,0);
 physics.x=center.x;physics.z=center.z;physics.step({throttle:0,brake:0,steer:0},1/120);physics.x=p.x;physics.z=p.z;physics.yaw=Math.atan2(next.x-p.x,next.z-p.z);
 physics.step({throttle:0,brake:0,steer:0},1/120);pose=new PoseInterpolator(physics);
 laps=new LapTracker(track.length);laps.reset(physics.trackProgress);maxHeightStep=0;previousHeight=physics.y;accumulator=0;
}
async function select(){
 loading=true;const id=route.value==='spa'?'spa':route.value==='monaco'?'monaco':route.value.startsWith('baku-')?'baku':'suzuka';await loadNativeCircuit(id);
 if(track)track.dispose();track=new Track(scene,TRACKS.find(t=>t.id===id)!);
 start=route.value==='chicane-approach'?5200:route.value==='baku-out'?2050:route.value==='baku-back'?4700:route.value==='spa'?1000:route.value==='monaco'?2010:route.value==='chicane'?5300:route.value==='lower'?2489.88481448:4860.14075137;end=start+(route.value==='chicane'?300:id==='monaco'?260:id==='spa'?250:120);
 reset();loading=false;
}
route.onchange=()=>void select();offset.onchange=()=>{if(!loading)reset();};
document.querySelector<HTMLButtonElement>('#pause')!.onclick=e=>{paused=!paused;(e.target as HTMLElement).textContent=paused?'再生':'一時停止';};
function resize(){renderer.setSize(innerWidth,innerHeight);car.camera.aspect=innerWidth/innerHeight;car.camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();await select();
renderer.setAnimationLoop(now=>{
 const dt=Math.min(.05,(now-last)/1000||0);last=now;
 if(!loading&&!paused){
  accumulator+=dt;
  while(accumulator>=1/120){
   distance+=40/120;if(distance>end){reset();break;}
   const p=point(distance),next=point(distance+.1);physics.x=p.x;physics.z=p.z;physics.yaw=Math.atan2(next.x-p.x,next.z-p.z);physics.vx=physics.vz=0;
   physics.step({steer:0,throttle:0,brake:0},1/120);pose.step(physics);
   if(physics.collided)laps.invalidate('接触');laps.update(physics.trackProgress,physics.allWheelsOffTrack,40,1/120);
   maxHeightStep=Math.max(maxHeightStep,Math.abs(physics.y-previousHeight));previousHeight=physics.y;accumulator-=1/120;
  }
 }
 if(!loading){const p=pose.sample(accumulator*120);car.setPose(p.x,p.z,p.yaw,p.y,p.gradientX,p.gradientZ);
 status.textContent=`${distance.toFixed(1)}m · 高さ ${physics.y.toFixed(2)}m · 最大高さ変化 ${(maxHeightStep*100).toFixed(2)}cm / tick · ${laps.valid?'VALID LAP':laps.invalidReason}`;}
 renderer.render(scene,car.camera);
});
