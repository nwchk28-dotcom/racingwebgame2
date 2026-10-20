import * as THREE from 'three';
import type { NativeCircuit } from './nativeCircuit';
import { RoadRibbon } from './roadRibbon';
import { DRIVING_SURFACE_LIFT, surfaceCuts } from './drivingSurface';
type Terrain = NativeCircuit['terrain'];

/** Uses the same grid diagonal as the native renderer, including below bridges. */
export function terrainHeight(terrain: Terrain, x: number, z: number): number {
  const gx=(x-terrain.minX)/terrain.spacing,gz=(z-terrain.minZ)/terrain.spacing;
  if(gx<0||gz<0||gx>=terrain.columns-1||gz>=terrain.rows-1)return terrain.baseHeight;
  const column=Math.floor(gx),row=Math.floor(gz),u=gx-column,v=gz-row;
  const i=row*terrain.columns+column;
  const a=terrain.heights[i],b=terrain.heights[i+1],d=terrain.heights[i+terrain.columns],c=terrain.heights[i+terrain.columns+1];
  return v<=u?a+(b-a)*u+(c-b)*v:a+(c-d)*u+(d-a)*v;
}
export function perimeterHeight(terrain:Terrain,fraction:number):number {
  const scaled=((fraction%1)+1)%1*(terrain.fenceHeights.length-1),i=Math.floor(scaled),t=scaled-i;
  return terrain.fenceHeights[i]*(1-t)+terrain.fenceHeights[i+1]*t;
}
function geometry(positions:number[],indices:number[]):THREE.BufferGeometry {
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(positions.flatMap((_,i)=>i%3===0?[positions[i]/40,positions[i+2]/40]:[]),2));
  g.setIndex(indices);g.computeVertexNormals();return g;
}
export function terrainGeometry(terrain:Terrain):THREE.BufferGeometry {
  const positions:number[]=[],indices:number[]=[];
  for(let z=0;z<terrain.rows;z++)for(let x=0;x<terrain.columns;x++){
    positions.push(terrain.minX+x*terrain.spacing,terrain.heights[z*terrain.columns+x],terrain.minZ+z*terrain.spacing);
    if(x<terrain.columns-1&&z<terrain.rows-1){const a=z*terrain.columns+x,b=a+1,d=a+terrain.columns,c=d+1;indices.push(a,d,c,a,c,b);}
  }
  return geometry(positions,indices);
}
/** Connect the exact rail bases to the scenic field; leave the underpass open. */
export function apronGeometry(data:NativeCircuit,ribbon=new RoadRibbon(data)):THREE.BufferGeometry {
  const positions:number[]=[],indices:number[]=[],terrain=data.terrain;
  for(let i=0;i<data.points.length-1;i++){
    const bridge=terrain.bridgeRange;
    if(bridge&&data.distances[i]>=bridge[0]&&data.distances[i]<=bridge[1])continue;
    const rows=surfaceCuts(data.distances[i],data.distances[i+1]-data.distances[i]);
    for(const side of [-1,1]){
      const limits=side>0?data.corridor.left:data.corridor.right;
      const outer=side>0?terrain.sceneryLeft:terrain.sceneryRight;
      for(let k=0;k<rows.length-1;k++){
        const v=positions.length/3;
        for(const t of [rows[k],rows[k+1]]){
          const offset=(limits[i]*(1-t)+limits[i+1]*t)*side,p=ribbon.at(i,t,offset);
          positions.push(p.x,p.height+DRIVING_SURFACE_LIFT,p.z);
          for(let axis=0;axis<3;axis++)positions.push(outer[i][axis]*(1-t)+outer[i+1][axis]*t);
        }
        indices.push(v,v+2,v+1,v+1,v+2,v+3);
      }
    }
  }
  return geometry(positions,indices);
}
