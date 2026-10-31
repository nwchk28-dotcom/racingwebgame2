import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { InstancedMesh, LOD, Matrix4, Mesh, Scene, Vector3 } from 'three';
import { CIRCUIT_SCENERY } from './circuitSceneryProfiles';
import { loadNativeCircuit, nativeCircuits } from './nativeCircuit';
import rawAlbert from './nativeCircuits/albert-park.json';
import { Track } from './track';
import { TRACKS } from './trackData';
import { sceneryFrame, type PlacedFacility } from './sceneryBuilder';
import { RECORD_VERSIONS } from './recordVersions';
import { terrainHeight } from './terrainScenery';

const additions=TRACKS.filter(t=>t.id!=='spa');
beforeAll(async()=>{
  await Promise.all(additions.map(t=>loadNativeCircuit(t.id)));
  vi.stubGlobal('document',{createElement:()=>({getContext:()=>({fillRect:()=>undefined})})});
});
afterAll(()=>vi.unstubAllGlobals());

it('covers every remaining course with a documented, distinct scenery profile',()=>{
  expect(Object.keys(CIRCUIT_SCENERY).sort()).toEqual(additions.map(t=>t.id).sort());
  for(const t of additions){
    const p=CIRCUIT_SCENERY[t.id]!;
    expect(p.references?.length,t.id).toBeGreaterThan(0);
    expect(new Set(p.facilities.map(f=>f.id)).size).toBe(p.facilities.length);
    expect(p.facilities.some(f=>!['pit','stand','city'].includes(f.kind)),`${t.id} landmark`).toBe(true);
    expect(RECORD_VERSIONS.tracks[t.id]).toBe(['monaco','suzuka'].includes(t.id)?2:1);
  }
  expect(RECORD_VERSIONS.global).toBe(9);expect(RECORD_VERSIONS.tracks.spa).toBe(1);
});

it.each(additions)('$id grounds scenery, clears every road arm, faces stands toward the road and disposes its resources',definition=>{
  const scene=new Scene(),track=new Track(scene,definition),profile=CIRCUIT_SCENERY[definition.id]!;
  const root=track.group.getObjectByName(`${definition.id}-scenery`)!;
  expect(root,definition.id).toBeDefined();
  expect(root.userData.missingFacilities,`${definition.id} missing facilities`).toEqual([]);
  expect(track.colliders,'removed legacy building collision circles').toEqual([]);
  track.group.updateMatrixWorld(true);
  const facilities=root.children.filter(o=>o.userData.facility);
  expect(facilities).toHaveLength(profile.facilities.length);
  for(const group of facilities){
    const p=group.userData.facility as PlacedFacility;
    expect([p.x,p.y,p.z,p.yaw].every(Number.isFinite)).toBe(true);
    for(let i=0;i<track.sampleCount;i++){
      const dx=track.samples[i].x-p.x,dz=track.samples[i].z-p.z,c=Math.cos(p.yaw),s=Math.sin(p.yaw);
      const n=track.native.normals[i],side=(p.x-track.samples[i].x)*n[0]+(p.z-track.samples[i].z)*n[1];
      const margin=(side>=0?track.native.corridor.left[i]:track.native.corridor.right[i])+5;
      expect(Math.abs(dx*c-dz*s)>=p.width/2+margin||Math.abs(dx*s+dz*c)>=p.length/2+margin,`${definition.id}/${p.id} at ${track.distances[i]}`).toBe(true);
    }
    if(p.kind==='stand'){
      const road=sceneryFrame(track,p.distance),rows:Vector3[]=[],matrix=new Matrix4();
      group.traverse(o=>{
        if(!(o instanceof InstancedMesh))return;
        for(let i=0;i<o.count;i++){
          o.getMatrixAt(i,matrix);const scale=new Vector3().setFromMatrixScale(matrix);
          if(Math.abs(scale.x-p.width/10)<.001&&Math.abs(scale.y-.65)<.001&&Math.abs(scale.z-p.length+2)<.001)rows.push(new Vector3().setFromMatrixPosition(matrix).applyMatrix4(o.matrixWorld));
        }
      });
      rows.sort((a,b)=>a.y-b.y);expect(rows).toHaveLength(10);
      for(let i=1;i<rows.length;i++)expect(Math.hypot(rows[i].x-road.x,rows[i].z-road.z)).toBeGreaterThan(Math.hypot(rows[i-1].x-road.x,rows[i-1].z-road.z));
    }
  }
  const trees=root.userData.trees as {x:number;y:number;z:number}[];
  expect(trees.length,`${definition.id} tree count`).toBe(profile.treeCount);
  let crowns=0;
  root.traverse(o=>{
    expect(o instanceof LOD).toBe(false);
    if(o instanceof InstancedMesh&&o.name.endsWith('-tree-crowns'))crowns+=o.count;
  });
  expect(crowns).toBe(trees.length);
  for(const t of trees.filter((_,i)=>i%19===0))expect(t.y).toBe(terrainHeight(track.native.terrain,t.x,t.z));
  let geometries=0,disposed=0;const seen=new Set();
  root.traverse(o=>{if(o instanceof Mesh&&!seen.has(o.geometry)){seen.add(o.geometry);geometries++;o.geometry.addEventListener('dispose',()=>disposed++);}});
  track.dispose();expect(disposed).toBe(geometries);expect(scene.children).toHaveLength(0);
},15000);

it('carves water beds away from the driving surface without mutating the source or lowering water on reload',()=>{
  const definition=TRACKS.find(t=>t.id==='albert-park')!,track=new Track(new Scene(),definition),data=nativeCircuits['albert-park'];
  expect(data.surface).toEqual(rawAlbert.surface);
  expect(data.corridor).toEqual(rawAlbert.corridor);
  const field=data.terrain;let changed=0;
  field.heights.forEach((height,k)=>{
    if(height===rawAlbert.terrain.heights[k])return;
    changed++;
    const x=field.minX+k%field.columns*field.spacing,z=field.minZ+Math.floor(k/field.columns)*field.spacing;
    const near=track.nearest(x,z),i=track.ribbon!.segmentAt(near.progress);
    expect(height).toBeLessThan(rawAlbert.terrain.heights[k]);
    expect(near.distance).toBeGreaterThan(Math.max(data.corridor.left[i],data.corridor.right[i])+field.spacing*2);
  });
  expect(changed).toBeGreaterThan(0);
  const water=track.group.getObjectByName('albert-park-albert-park-lake-north')!,level=water.position.y;
  track.dispose();const reloaded=new Track(new Scene(),definition);
  expect(reloaded.native.terrain).toBe(field);
  expect(reloaded.group.getObjectByName(water.name)!.position.y).toBe(level);
  reloaded.dispose();
},15000);
