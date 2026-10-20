import { beforeAll, expect, it } from 'vitest';
import { loadNativeCircuit } from './nativeCircuit';
import { TrackPath } from './trackPath';
import { TRACKS } from './trackData';
import { CarPhysics } from './physics';
import { TrackWalls } from './trackWalls';
import { LapTracker } from './lap';
import { Vector3 } from 'three';

beforeAll(async()=>{await Promise.all(['spa','suzuka'].map(loadNativeCircuit));});
function at(path:TrackPath,distance:number,offset=0){
  let lo=0,hi=path.sampleCount;
  while(lo+1<hi){const mid=(lo+hi)>>>1;if(path.distances[mid]<=distance)lo=mid;else hi=mid;}
  const t=(distance-path.distances[lo])/(path.distances[hi]-path.distances[lo]);
  const a=path.samples[lo],b=path.samples[hi],n=path.normals[lo].clone().lerp(path.normals[hi],t).normalize();
  return {x:a.x+(b.x-a.x)*t+n.x*offset,z:a.z+(b.z-a.z)*t+n.z*offset};
}
it('tracks sub-metre travel on a hill without holding then jumping height',()=>{
  const p=new TrackPath(TRACKS.find(t=>t.id==='spa')!);let hint=1000/p.length,maxError=0;
  for(let d=1000;d<=1100;d+=.1){const point=at(p,d),surface=p.surfaceAt(point.x,point.z,hint);hint=surface.progress;maxError=Math.max(maxError,Math.abs(hint*p.length-d));}
  expect(maxError).toBeLessThan(.001);
});
it('retains each Suzuka crossing arm across the entire road width',()=>{
 const p=new TrackPath(TRACKS.find(t=>t.id==='suzuka')!);
 for(const crossing of [2549.88481448,4920.14075137])for(const offset of [-3,0,3]){
  let hint=(crossing-60)/p.length;
  for(let d=crossing-60;d<crossing+60;d+=.25){const point=at(p,d,offset),near=p.nearest(point.x,point.z,hint);hint=near.progress;
   expect(Math.abs(hint*p.length-d),`${crossing}, ${offset}, ${d}`).toBeLessThan(2);
  }
 }
});

it('keeps wheels, contact height and lap validity on both levels of Suzuka',()=>{
 const path=new TrackPath(TRACKS.find(t=>t.id==='suzuka')!),walls=new TrackWalls(path);
 for(const crossing of [2549.88481448,4920.14075137])for(const offset of [-3,0,3]){
  const start=at(path,crossing-60,offset);
  const car=new CarPhysics({start:new Vector3(start.x,0,start.z),startYaw:0,curbOuterEdge:7.2,
    outerFence:{centerX:0,centerZ:0,radius:10000},colliders:[],walls,
    nearest:path.nearest.bind(path),surfaceAt:path.surfaceAt.bind(path),curbOuterEdgeAt:path.curbOuterEdgeAt.bind(path)});
  const laps=new LapTracker(path.length);laps.reset(car.trackProgress);
  let previousHeight=car.y;
  for(let d=crossing-60;d<crossing+60;d+=.25){
    const p=at(path,d,offset),next=at(path,d+.1,offset);car.x=p.x;car.z=p.z;car.yaw=Math.atan2(next.x-p.x,next.z-p.z);car.vx=car.vz=0;
    car.step({steer:0,throttle:0,brake:0},1/120);
    expect(car.collided,`collision at ${crossing}, ${offset}, ${d}`).toBe(false);
    expect(car.allWheelsOffTrack).toBe(false);
    expect(Math.abs(car.y-previousHeight)).toBeLessThan(.1);previousHeight=car.y;
    laps.update(car.trackProgress,car.allWheelsOffTrack,30,1/120);
    expect(laps.valid,`${crossing}, ${offset}, ${d}: ${laps.invalidReason}`).toBe(true);
  }
 }
});
