import {beforeAll,expect,it} from 'vitest';
import {loadNativeCircuit} from './nativeCircuit';
import {TrackPath} from './trackPath';
import {TRACKS} from './trackData';
import {TrackWalls} from './trackWalls';
import {CarPhysics} from './physics';
beforeAll(()=>loadNativeCircuit('baku'));
function fixture(){
 const path=new TrackPath(TRACKS.find(t=>t.id==='baku')!);
 const track=Object.assign(path,{walls:new TrackWalls(path),curbOuterEdge:path.curbOuterEdgeAt(0),colliders:path.native.obstacles,outerFence:path.native.fence});
 return {path,track};
}
it.each([2090,2173,2241,4635,4718,4786])('does not snap toward the adjacent straight at %sm',distance=>{
 const {path,track}=fixture(),r=path.ribbon!,i=r.segmentAt(distance/path.length),t=(distance-path.distances[i])/(path.distances[i+1]-path.distances[i]);
 let maxMove=0,maxHeightStep=0;
 for(const offset of [4,5,6,6.4]){
  const p=r.at(i,t,offset),f=r.frame(i,t),car=new CarPhysics(track);
  // Establish the intended road arm before moving toward the dividing rails.
  const center=r.at(i,t,0);car.x=center.x;car.z=center.z;car.yaw=Math.atan2(f.dx,f.dz);car.step({throttle:0,brake:0,steer:0},1/120);
  car.x=p.x;car.z=p.z;car.vx=Math.sin(car.yaw)*30;car.vz=Math.cos(car.yaw)*30;
  for(let step=0;step<120;step++){
   const x=car.x,z=car.z,y=path.surfaceAt(x,z,car.trackProgress).height;
   car.step({throttle:0,brake:0,steer:0},1/120);
   maxMove=Math.max(maxMove,Math.hypot(car.x-x,car.z-z));maxHeightStep=Math.max(maxHeightStep,Math.abs(car.y-y));
   const arc=Math.abs(car.trackProgress-distance/path.length);
   expect(Math.min(arc,1-arc)*path.length).toBeLessThan(60);
  }
 }
 expect(maxMove).toBeLessThan(.5);expect(maxHeightStep).toBeLessThan(.1);
});
