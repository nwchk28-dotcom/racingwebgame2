import { beforeAll, expect, it } from 'vitest';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { loadNativeCircuit, nativeCircuits } from './nativeCircuit';
import { TRACKS } from './trackData';
import { RoadRibbon } from './roadRibbon';
import { apronGeometry, terrainGeometry } from './terrainScenery';
import { drivingSurfaceGeometry, DRIVING_SURFACE_LIFT, surfaceBands } from './drivingSurface';
beforeAll(async()=>{await Promise.all(TRACKS.map(t=>loadNativeCircuit(t.id)));});
it.each(TRACKS)('$id partitions road, kerbs and runoff without overlapping surface layers',definition=>{
 const d=nativeCircuits[definition.id];
 for(let i=0;i<d.points.length-1;i+=19){
  const bands=surfaceBands(d.widths[i],d.curbWidth,d.corridor.left[i],d.corridor.right[i],true);
  expect(bands[0].inner).toBe(-d.corridor.right[i]);expect(bands.at(-1)!.outer).toBe(d.corridor.left[i]);
  for(let j=0;j<bands.length;j++){
   expect(bands[j].outer).toBeGreaterThanOrEqual(bands[j].inner);
   if(j)expect(bands[j].inner).toBe(bands[j-1].outer);
  }
 }
});
it.each(TRACKS)('$id draws exactly one surface outside either curb',definition=>{
 const id=definition.id;
 const d=nativeCircuits[id],ribbon=new RoadRibbon(d),geometries=drivingSurfaceGeometry(ribbon);
 const material=new MeshBasicMaterial({side:DoubleSide});
 const meshes=[...Object.values(geometries),terrainGeometry(d.terrain),apronGeometry(d,ribbon)].map(g=>new Mesh(g,material));meshes.forEach(m=>m.updateMatrixWorld());
 const ray=new Raycaster();
 for(let i=21;i<ribbon.count-20;i+=Math.ceil(ribbon.count/9)){
  const t=.371,width=d.widths[i]*(1-t)+d.widths[i+1]*t,curb=width+d.curbWidth;
  for(const side of [-1,1])for(const delta of [-.05,.2]){
   const p=ribbon.at(i,t,side*(curb+delta));ray.set(new Vector3(p.x,p.height+1,p.z),new Vector3(0,-1,0));
   const allHits=ray.intersectObjects(meshes);
   expect(allHits[0].point.y).toBeLessThan(p.height+DRIVING_SURFACE_LIFT+.015);
   const hits=allHits.filter(h=>Math.abs(h.point.y-p.height-DRIVING_SURFACE_LIFT)<.08);
   expect(hits.length,`${id} ${i} ${side} ${delta}`).toBe(1);
   expect(Math.abs(hits[0].point.y-p.height-DRIVING_SURFACE_LIFT)).toBeLessThan(.015);
  }
 }
 meshes.forEach(m=>m.geometry.dispose());material.dispose();
},15000);
