import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Matrix4, Mesh, InstancedMesh, Scene } from 'three';
import { loadNativeCircuit, nativeCircuits } from './nativeCircuit';
import { TRACKS } from './trackData';
import { Track } from './track';
import { perimeterHeight, terrainHeight } from './terrainScenery';
import { surfaceCuts } from './drivingSurface';

beforeAll(async()=>{
 await Promise.all(['spa','suzuka'].map(loadNativeCircuit));
 vi.stubGlobal('document',{createElement:()=>({width:256,height:256,getContext:()=>({fillStyle:'',fillRect:()=>undefined})})});
});
afterAll(()=>vi.unstubAllGlobals());
it.each(['spa','suzuka'])('%s places perimeter rails and posts on native ground and joins trackside rails to the terrain',id=>{
 const data=nativeCircuits[id],track=new Track(new Scene(),TRACKS.find(t=>t.id===id)!);
 expect(track.group.getObjectByName('terrain-backdrop')).toBeUndefined();
 const field=track.group.getObjectByName('terrain-field') as Mesh;
 expect(field.geometry.getAttribute('position').count).toBe(data.terrain.columns*data.terrain.rows);
 const rails=track.group.children.filter(c=>c.name==='perimeter-rail') as Mesh[];
 expect(rails).toHaveLength(3);
 for(const [band,rail] of rails.entries()){
  const vertices=rail.geometry.getAttribute('position');
  for(let i=0;i<512;i+=11){
   expect(vertices.getY(i*8)).toBeCloseTo(perimeterHeight(data.terrain,i/512)+[.65,1.15,1.65][band]-.15,4);
  }
 }
 const posts=track.group.getObjectByName('perimeter-posts') as InstancedMesh,matrix=new Matrix4();
 for(let i=0;i<posts.count;i+=17){posts.getMatrixAt(i,matrix);expect(matrix.elements[13]-.95).toBeCloseTo(perimeterHeight(data.terrain,i/posts.count),4);}
 const apron=track.group.getObjectByName('terrain-apron') as Mesh;
 expect(apron.geometry.getAttribute('position').count).toBeGreaterThan(0);
 const vertices=apron.geometry.getAttribute('position');
 // Every outside apron edge terminates on the baked native scenic ground.
 expect(vertices.getY(1)).toBeCloseTo(data.terrain.sceneryRight[0][1],4);
 expect(vertices.getY(4*(surfaceCuts(data.distances[0],data.distances[1]-data.distances[0]).length-1)+1)).toBeCloseTo(data.terrain.sceneryLeft[0][1],4);
 track.dispose();
});
it('keeps the terrain field below the lower Suzuka crossing arm',()=>{
 const data=nativeCircuits.suzuka,point={x:-887.25633182,z:-71.56775933};
 expect(terrainHeight(data.terrain,point.x,point.z)).toBeLessThan(-2);
});
