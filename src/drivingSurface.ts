import * as THREE from 'three';
import { RoadRibbon } from './roadRibbon';
export type SurfaceKind='road'|'curb-red'|'curb-white'|'runoff';
export const DRIVING_SURFACE_LIFT=.018;
interface Bucket {positions:number[];normals:number[];uvs:number[];indices:number[]}
export interface SurfaceBand {inner:number;outer:number;kind:SurfaceKind}
/** Disjoint horizontal intervals: no grass beneath the asphalt or kerbs. */
export function surfaceBands(width:number,curb:number,left:number,right:number,red:boolean):SurfaceBand[]{
 const stripe:SurfaceKind=red?'curb-red':'curb-white';
 return [
  {inner:-right,outer:-width-curb,kind:'runoff'},
  {inner:-width-curb,outer:-width,kind:stripe},
  {inner:-width,outer:-width+.1,kind:'road'},
  {inner:-width+.1,outer:-width+.33,kind:'curb-white'},
  {inner:-width+.33,outer:width-.33,kind:'road'},
  {inner:width-.33,outer:width-.1,kind:'curb-white'},
  {inner:width-.1,outer:width,kind:'road'},
  {inner:width,outer:width+curb,kind:stripe},
  {inner:width+curb,outer:left,kind:'runoff'},
 ];
}
export function surfaceCuts(start:number,span:number):number[]{
 const steps=Math.max(1,Math.ceil(span/1.25)),cuts=new Set(Array.from({length:steps+1},(_,k)=>k/steps));
 for(let d=(Math.floor(start/4)+1)*4;d<start+span-1e-7;d+=4)cuts.add((d-start)/span);
 return [...cuts].sort((a,b)=>a-b);
}
export function drivingSurfaceGeometry(ribbon:RoadRibbon):Record<SurfaceKind,THREE.BufferGeometry>{
 const data=ribbon.data,buckets:Record<SurfaceKind,Bucket>={road:{positions:[],normals:[],uvs:[],indices:[]},'curb-red':{positions:[],normals:[],uvs:[],indices:[]},'curb-white':{positions:[],normals:[],uvs:[],indices:[]},runoff:{positions:[],normals:[],uvs:[],indices:[]}};
 for(let i=0;i<ribbon.count;i++){
  const start=data.distances[i],span=data.distances[i+1]-start,rows=surfaceCuts(start,span);
  for(let k=0;k<rows.length-1;k++){
   const red=Math.floor((start+span*(rows[k]+rows[k+1])/2)/4)%2===0;
   const bands=rows.slice(k,k+2).map(t=>{
    const mix=(a:number,b:number)=>a+(b-a)*t;
    return surfaceBands(mix(data.widths[i],data.widths[i+1]),data.curbWidth,mix(data.corridor.left[i],data.corridor.left[i+1]),mix(data.corridor.right[i],data.corridor.right[i+1]),red);
   });
   for(let band=0;band<bands[0].length;band++){
    const a=bands[0][band],b=bands[1][band];if(a.outer-a.inner<1e-8&&b.outer-b.inner<1e-8)continue;
    // Subdivide across the width as well as along the track so changing
    // bank angles are represented without large diagonal interpolation errors.
    const columns=Math.max(1,Math.ceil(Math.max(a.outer-a.inner,b.outer-b.inner)/3));
    for(let column=0;column<columns;column++){
     const bucket=buckets[a.kind],base=bucket.positions.length/3;
     for(let row=0;row<2;row++){
      const t=rows[k+row],edge=bands[row][band];
      for(const fraction of [column/columns,(column+1)/columns]){
       const offset=edge.inner+(edge.outer-edge.inner)*fraction;
       const p=ribbon.at(i,t,offset),length=Math.hypot(p.gradientX,1,p.gradientZ);
       bucket.positions.push(p.x,p.height+DRIVING_SURFACE_LIFT,p.z);
       bucket.normals.push(-p.gradientX/length,1/length,-p.gradientZ/length);
       bucket.uvs.push(a.kind==='runoff'?p.x/40:offset/14,a.kind==='runoff'?p.z/40:(start+span*t)/25);
      }
     }
     bucket.indices.push(base,base+2,base+1,base+1,base+2,base+3);
    }
   }
  }
 }
 return Object.fromEntries(Object.entries(buckets).map(([kind,b])=>{
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uvs,2));g.setIndex(b.indices);return [kind,g];
 })) as Record<SurfaceKind,THREE.BufferGeometry>;
}
