import {beforeAll,expect,it} from 'vitest';
import {loadNativeCircuit} from './nativeCircuit';
import {TrackPath} from './trackPath';
import {TRACKS} from './trackData';
import {CarPhysics} from './physics';
import {TrackWalls} from './trackWalls';
beforeAll(()=>loadNativeCircuit('suzuka'));
it('keeps the final chicane approach clear of invisible rail extensions',()=>{
 const path=new TrackPath(TRACKS.find(t=>t.id==='suzuka')!),walls=new TrackWalls(path),r=path.ribbon!;
 const bad:unknown[]=[];
 for(let distance=5150;distance<5350;distance+=1){
  const i=r.segmentAt(distance/path.length),t=(distance-path.distances[i])/(path.distances[i+1]-path.distances[i]);
  for(const offset of [0,2,4,6,7,8]){
   const p=r.at(i,t,offset),f=r.frame(i,t),yaw=Math.atan2(f.dx,f.dz),sin=Math.sin(yaw),cos=Math.cos(yaw);
   for(const lx of [-.9,.9])for(const lz of [4.3,2.4,-1.75]){
    const x=p.x+lx*cos+lz*sin,z=p.z-lx*sin+lz*cos,hit=walls.contact(x,z,.1,p.height,p.x,p.z);
    if(hit){bad.push({distance,offset,lx,lz,depth:hit.depth,normal:[hit.normalX,hit.normalZ],x,z});break;}
   }
  }
 }
 expect(bad).toHaveLength(0);
});

it.each([5247,5248,5249,5250])('does not invalidate a car with wheels still on the curb at %sm',distance=>{
 const path=new TrackPath(TRACKS.find(t=>t.id==='suzuka')!),r=path.ribbon!,walls=new TrackWalls(path);
 const track=Object.assign(path,{walls,curbOuterEdge:path.curbOuterEdgeAt(0),colliders:path.native.obstacles,outerFence:path.native.fence});
 const i=r.segmentAt(distance/path.length),t=(distance-path.distances[i])/(path.distances[i+1]-path.distances[i]),f=r.frame(i,t),center=r.at(i,t,0);
 for(const offset of [7,7.7,8]){
  const car=new CarPhysics(track);car.x=center.x;car.z=center.z;car.yaw=Math.atan2(f.dx,f.dz);
  car.step({throttle:0,brake:0,steer:0},1/120);
  const p=r.at(i,t,offset);car.x=p.x;car.z=p.z;
  for(let tick=0;tick<10;tick++){
   car.step({throttle:0,brake:0,steer:0},1/120);
   expect(car.allWheelsOffTrack).toBe(false);
   expect(car.collided).toBe(false);
   expect(Math.hypot(car.x-p.x,car.z-p.z)).toBeLessThan(.001);
  }
 }
});
