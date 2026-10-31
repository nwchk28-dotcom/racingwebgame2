import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { InstancedMesh, LOD, Matrix4, Mesh, Scene, Vector3, type BufferGeometry } from 'three';
import rawSpa from './nativeCircuits/spa.json';
import type { NativeCircuit } from './nativeCircuit';
import { loadNativeCircuit, nativeCircuits } from './nativeCircuit';
import { SPA_ELEVATION, prepareSpaTerrain, spaElevation } from './spaTerrain';
import { SPA_FACILITIES, placeSpaFacilities, spaFrame, type PlacedFacility } from './spaScenery';
import { TrackPath } from './trackPath';
import { Track } from './track';
import { RoadRibbon } from './roadRibbon';
import { TRACKS } from './trackData';
import { terrainHeight } from './terrainScenery';
import { RECORD_VERSIONS } from './recordVersions';
import { CarPhysics } from './physics';
import { LapTracker } from './lap';

beforeAll(async()=>{
  await loadNativeCircuit('spa');
  vi.stubGlobal('document',{createElement:()=>({getContext:()=>({fillRect:()=>undefined})})});
});
afterAll(()=>vi.unstubAllGlobals());
const definition=TRACKS.find(t=>t.id==='spa')!;

it('retains the documented range, monotonic slopes and periodic pit plateau',()=>{
  for(let i=0;i<SPA_ELEVATION.length-1;i++){
    const [a,ha]=SPA_ELEVATION[i],[b,hb]=SPA_ELEVATION[i+1];
    for(let d=a;d<b;d+=.5){
      const p=spaElevation(d);
      expect(p.height).toBeGreaterThanOrEqual(Math.min(ha,hb)-1e-8);
      expect(p.height).toBeLessThanOrEqual(Math.max(ha,hb)+1e-8);
      expect(Math.abs(p.grade)).toBeLessThan(.24);
      const finiteDifference=(spaElevation(d+.001).height-spaElevation(d-.001).height)/.002;
      expect(p.grade).toBeCloseTo(finiteDifference,5);
    }
  }
  expect(spaElevation(2520).height-spaElevation(5040).height).toBeCloseTo(102.2,6);
  expect(spaElevation(1210).height-spaElevation(870).height).toBeCloseTo(40,6);
  expect(spaElevation(0)).toEqual(spaElevation(7004));
  for(const d of [0,100,180,6220,6400,6550,6760,6900])expect(spaElevation(d).grade).toBe(0);
  // Intermediate climbing points must not all become flat plateaus.
  for(const d of [990,1130,1210,1700,2200])expect(spaElevation(d).grade).toBeGreaterThan(.01);
});

it('reconstructs deterministically without changing exported geometry or other courses',()=>{
  const original=rawSpa as NativeCircuit,before=JSON.stringify(original);
  const result=prepareSpaTerrain(original);
  expect(JSON.stringify(original)).toBe(before);
  expect(result).toEqual(nativeCircuits.spa);
  for(const key of ['points','normals','widths','distances','fence'] as const)expect(result[key]).toEqual(original[key]);
  expect(result.obstacles).toEqual([]);
  expect(result.surface.some((s,i)=>Math.abs(s[1]-original.surface[i][1])>.005)).toBe(true);
  expect(RECORD_VERSIONS.global).toBe(9);
  expect(RECORD_VERSIONS.tracks.spa).toBe(1);
});

it('keeps the new road C1 continuous through every sampled boundary',()=>{
  const data=nativeCircuits.spa,r=new RoadRibbon(data);
  for(let i=0;i<r.count;i++)for(const offset of [-8,0,8]){
    const a=r.at(i,1,offset),b=r.at((i+1)%r.count,0,offset);
    expect(a.height).toBeCloseTo(b.height,6);
    expect(a.gradientX).toBeCloseTo(b.gradientX,5);
    expect(a.gradientZ).toBeCloseTo(b.gradientZ,5);
  }
});

it('keeps contact, all four wheels and lap validity through a full Spa centerline replay',()=>{
  const track=new Track(new Scene(),definition),car=new CarPhysics(track),laps=new LapTracker(track.length);
  laps.reset(0);let previousHeight=0;
  for(let d=0;d<track.length;d+=2){
    const r=track.ribbon!,i=r.segmentAt(d/track.length),t=(d-track.distances[i])/(track.distances[i+1]-track.distances[i]);
    const p=r.at(i,t,0),frame=r.frame(i,t);
    car.x=p.x;car.z=p.z;car.yaw=Math.atan2(frame.dx,frame.dz);car.vx=car.vz=0;
    car.step({steer:0,throttle:0,brake:0},1/120);
    expect(car.collided,`contact at ${d}m`).toBe(false);
    expect(car.allWheelsOffTrack,`wheels at ${d}m`).toBe(false);
    expect(Math.abs(car.y-p.height)).toBeLessThan(.02);
    expect(Math.abs(car.y-previousHeight)).toBeLessThan(.5);previousHeight=car.y;
    laps.update(car.trackProgress,car.allWheelsOffTrack,60,2/60);
    expect(laps.valid,`lap at ${d}m: ${laps.invalidReason}`).toBe(true);
  }
  track.dispose();
},15000);

it('places every named facility outside every road arm and runoff corridor',()=>{
  const path=new TrackPath(definition),facilities=placeSpaFacilities(path);
  expect(facilities.map(f=>f.id)).toEqual(SPA_FACILITIES.map(f=>f.id));
  for(const f of facilities)for(let i=0;i<path.sampleCount;i++){
    const dx=path.samples[i].x-f.x,dz=path.samples[i].z-f.z,c=Math.cos(f.yaw),s=Math.sin(f.yaw);
    const margin=Math.max(path.native.corridor.left[i],path.native.corridor.right[i])+5;
    expect(Math.abs(dx*c-dz*s)>=f.width/2+margin||Math.abs(dx*s+dz*c)>=f.length/2+margin,`${f.id} at ${path.distances[i]}`).toBe(true);
  }
});

it('keeps upper stand rows farther from the road on both sides of the circuit',()=>{
  const track=new Track(new Scene(),definition),root=track.group.getObjectByName('spa-scenery')!;
  track.group.updateMatrixWorld(true);
  const sides=new Set<number>();
  for(const stand of root.children.filter(o=>o.userData.facility?.kind==='stand')){
    const f=stand.userData.facility as PlacedFacility,road=spaFrame(track,f.distance);
    sides.add(Math.sign(f.offset));
    const rows:Vector3[]=[],matrix=new Matrix4();
    stand.traverse(o=>{
      if(!(o instanceof InstancedMesh))return;
      for(let i=0;i<o.count;i++){
        o.getMatrixAt(i,matrix);
        const dimensions=new Vector3().setFromMatrixScale(matrix);
        // Actual seat platforms, excluding spectators, posts and canopy.
        if(Math.abs(dimensions.x-f.width/10)<.001&&Math.abs(dimensions.y-.65)<.001&&Math.abs(dimensions.z-f.length+2)<.001){
          rows.push(new Vector3().setFromMatrixPosition(matrix).applyMatrix4(o.matrixWorld));
        }
      }
    });
    rows.sort((a,b)=>a.y-b.y);expect(rows,`${f.id} seat platforms`).toHaveLength(10);
    const toRoad=(p:Vector3)=>Math.hypot(p.x-road.x,p.z-road.z);
    for(let i=1;i<rows.length;i++)expect(toRoad(rows[i]),`${f.id}: upper row must recede from the road`).toBeGreaterThan(toRoad(rows[i-1]));
  }
  expect([...sides].sort()).toEqual([-1,1]);track.dispose();
},15000);

it('grounds a persistent forest with all crowns present and releases its shared geometry',()=>{
  const scene=new Scene(),track=new Track(scene,definition),root=track.group.getObjectByName('spa-scenery')!;
  const trees=root.userData.trees as {x:number;y:number;z:number}[];
  expect(trees).toHaveLength(2700);
  for(const t of trees.filter((_,i)=>i%13===0)){
    expect(t.y).toBe(terrainHeight(track.native.terrain,t.x,t.z));
    const near=track.nearest(t.x,t.z),i=track.ribbon!.segmentAt(near.progress);
    expect(near.distance).toBeGreaterThanOrEqual(Math.max(track.native.corridor.left[i],track.native.corridor.right[i])+13);
  }
  const cells=root.children.filter(c=>c.name==='spa-forest-cell');
  expect(cells.length).toBeGreaterThan(20);
  let trunks=0,crowns=0;
  root.traverse(o=>{
    expect(o instanceof LOD,'trees must never be distance-switched or removed').toBe(false);
    if(o instanceof InstancedMesh){
      if(o.name==='spa-tree-trunks')trunks+=o.count;
      if(o.name==='spa-tree-crowns')crowns+=o.count;
      if(o.name.startsWith('spa-tree-'))expect(o.visible).toBe(true);
    }
  });
  expect(trunks).toBe(trees.length);expect(crowns).toBe(trees.length);
  const geometries=new Set<BufferGeometry>();
  root.traverse(o=>{if(o instanceof Mesh)geometries.add(o.geometry);});
  let disposed=0;geometries.forEach(g=>g.addEventListener('dispose',()=>disposed++));
  track.dispose();expect(disposed).toBe(geometries.size);expect(scene.children).toHaveLength(0);
},15000);
