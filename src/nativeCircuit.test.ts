import { beforeAll, describe, expect, it } from 'vitest';
import { loadNativeCircuit, nativeCircuits } from './nativeCircuit';
import { TRACKS } from './trackData';
import { TrackPath } from './trackPath';
import { TrackWalls } from './trackWalls';
import { CarPhysics } from './physics';

beforeAll(async()=>{await Promise.all(TRACKS.map(t=>loadNativeCircuit(t.id)));});
describe('iOS course transfer',()=>{
  it.each(TRACKS)('$id uses native geometry, widths, elevations and exact barrier endpoints',d=>{
    const path=new TrackPath(d),n=nativeCircuits[d.id],walls=new TrackWalls(path);
    expect(path.sampleCount).toBe(n.points.length-1);
    expect(path.length).toBeCloseTo(n.length,3);
    expect(walls.segments).toHaveLength(n.corridor.barriers.filter(w=>!w.passable).length);
    for(let i=0;i<path.sampleCount;i+=73){
      expect([path.samples[i].x,path.samples[i].z]).toEqual(n.points[i]);
      expect(path.roadHalfWidthAt(path.distances[i]/path.length)).toBeCloseTo(n.widths[i],4);
      const p=path.samples[i],surface=path.surfaceAt(p.x,p.z,path.distances[i]/path.length);
      expect(surface.height).toBeCloseTo(n.surface[i][0],2);
    }
    expect(walls.segments[0].ax).toBe(n.corridor.barriers[0].a.x);
  });
  it('keeps car pose finite and driveable across both painted edges on Spa',()=>{
    const path=new TrackPath(TRACKS.find(d=>d.id==='spa')!);
    const walls=new TrackWalls(path);
    const car=new CarPhysics(Object.assign(path,{walls,curbOuterEdge:8,colliders:[],outerFence:{centerX:0,centerZ:0,radius:10000}}));
    for(let i=150;i<path.sampleCount;i+=173){
      const p=path.samples[i],n=path.normals[i],progress=path.distances[i]/path.length;
      for(const side of [-1,1]){
        const edge=path.curbOuterEdgeAt(progress),a=path.surfaceAt(p.x+n.x*(edge-.01)*side,p.z+n.z*(edge-.01)*side,progress),b=path.surfaceAt(p.x+n.x*(edge+.01)*side,p.z+n.z*(edge+.01)*side,progress);
        expect(Math.abs(a.height-b.height)).toBeLessThan(.03);
      }
      car.x=p.x;car.z=p.z;car.vx=car.vz=0;
      car.step({throttle:1,brake:0,steer:.2},1/120);
      expect([car.x,car.y,car.z,car.gradientX,car.gradientZ,car.speed].every(Number.isFinite)).toBe(true);
    }
  });
  it('does not collide with walls on another level at Suzuka',()=>{
    const path=new TrackPath(TRACKS.find(t=>t.id==='suzuka')!),walls=new TrackWalls(path);
    const w=walls.segments.find(w=>(w.heightA??0)>5)!;
    const x=(w.ax+w.bx)/2+w.inwardX*.1,z=(w.az+w.bz)/2+w.inwardZ*.1,h=((w.heightA??0)+(w.heightB??0))/2;
    expect(walls.contact(x,z,.35,h)?.depth).toBeGreaterThan(0);
    expect(walls.contact(x,z,.35,h+100)).toBeNull();
  });
});

it.each(['monaco','suzuka'])('%s keeps native escape openings free of visible and collidable rails',id=>{
 const path=new TrackPath(TRACKS.find(t=>t.id===id)!),walls=new TrackWalls(path),barriers=nativeCircuits[id].corridor.barriers;
 const openings=barriers.filter(w=>w.passable);
 expect(openings.length).toBeGreaterThan(0);
 for(const w of openings.filter((_,i)=>i%7===3)){
  const x=(w.a.x+w.b.x)/2,z=(w.a.z+w.b.z)/2,h=(w.heightA+w.heightB)/2;
  for(const offset of [-1,0,1])expect(walls.contact(x+w.inward.x*offset,z+w.inward.z*offset,.35,h),`${id} opening at ${x},${z}`).toBeNull();
 }
 // The outer safety rails remain present and collidable.
 for(const w of barriers.slice(-3)){
  const x=(w.a.x+w.b.x)/2+w.inward.x*.1,z=(w.a.z+w.b.z)/2+w.inward.z*.1;
  expect(walls.contact(x,z,.35,(w.heightA+w.heightB)/2)).not.toBeNull();
 }
});
