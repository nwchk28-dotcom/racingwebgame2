import { beforeAll, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { loadNativeCircuit, nativeCircuits } from './nativeCircuit';
import { TRACKS } from './trackData';
import { RoadRibbon } from './roadRibbon';
import { drivingSurfaceGeometry } from './drivingSurface';
import { apronGeometry, terrainGeometry } from './terrainScenery';

class HeightIndex {
 private cells=new Map<string,number[]>();private triangles:number[][]=[];
 constructor(geometry:BufferGeometry){
  const p=geometry.getAttribute('position'),indices=geometry.getIndex()!;
  for(let i=0;i<indices.count;i+=3){
   const tri=[0,1,2].flatMap(k=>{const v=indices.getX(i+k);return [p.getX(v),p.getY(v),p.getZ(v)];}),id=this.triangles.push(tri)-1;
   for(let x=Math.floor(Math.min(tri[0],tri[3],tri[6])/32);x<=Math.floor(Math.max(tri[0],tri[3],tri[6])/32);x++)
    for(let z=Math.floor(Math.min(tri[2],tri[5],tri[8])/32);z<=Math.floor(Math.max(tri[2],tri[5],tri[8])/32);z++){
     const key=x+','+z,list=this.cells.get(key)??[];list.push(id);this.cells.set(key,list);
    }
  }
 }
 height(x:number,z:number,ceiling:number){
  let height=-Infinity;
  for(const i of this.cells.get(Math.floor(x/32)+','+Math.floor(z/32))??[]){
   const t=this.triangles[i],ax=t[0],az=t[2],bx=t[3],bz=t[5],cx=t[6],cz=t[8],det=(bx-ax)*(cz-az)-(bz-az)*(cx-ax);
   if(Math.abs(det)<1e-9)continue;
   const u=((x-ax)*(cz-az)-(z-az)*(cx-ax))/det,v=((bx-ax)*(z-az)-(bz-az)*(x-ax))/det;
   if(u<0||v<0||u+v>1)continue;
   const y=t[1]+(t[4]-t[1])*u+(t[7]-t[1])*v;if(y<ceiling)height=Math.max(height,y);
  }
  return height;
 }
}
beforeAll(async()=>{await Promise.all(TRACKS.map(t=>loadNativeCircuit(t.id)));});
it.each(TRACKS)('$id keeps grass below the banked asphalt',definition=>{
 const d=nativeCircuits[definition.id],r=new RoadRibbon(d),apron=apronGeometry(d,r),field=terrainGeometry(d.terrain),meshes=drivingSurfaceGeometry(r),road=new HeightIndex(meshes.road),indices=[new HeightIndex(apron),new HeightIndex(field),new HeightIndex(meshes.runoff)];
 let max=-Infinity,worst='';
 for(let i=0;i<r.count;i++){
  if(Math.abs(d.surface[i][2])<.015&&Math.abs(d.surface[i+1][2])<.015)continue;
  for(const t of [.25,.5,.75])for(const f of [-.9,-.75,-.5,0,.5,.75,.9]){
   const width=d.widths[i]*(1-t)+d.widths[i+1]*t,p=r.at(i,t,width*f);
   expect(Math.abs(road.height(p.x,p.z,p.height+1)-p.height-.018),`asphalt at ${i},${t},${f}`).toBeLessThan(.015);
   for(let k=0;k<indices.length;k++){const delta=indices[k].height(p.x,p.z,p.height+4)-p.height;if(delta>max){max=delta;worst=`${i},${t},${f},${['apron','field','runoff'][k]}, distance=${p.progress*d.length}`;}}
  }
 }
 apron.dispose();field.dispose();Object.values(meshes).forEach(g=>g.dispose());expect(max,worst).toBeLessThan(-.01);
},15000);
