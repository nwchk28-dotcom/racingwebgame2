import type { NativeCircuit } from './nativeCircuit';
import { terrainHeight } from './terrainScenery';

/** Source-informed control points, metres above the timing line. Not a survey.
 * Keep the native 102.2 m range, 40 m Raidillon climb and level pit straight.
 * See SPA_SCENERY_REFERENCES.md for sources and the deliberately retained assumptions. */
export const SPA_ELEVATION: readonly (readonly [number, number])[] = [
  [0,0],[180,0],[245,0],[870,-14],[900,-13.5],[990,-2],
  [1130,19.5],[1210,26],[1700,49],[2200,63],[2370,65],
  [2520,66.2],[2650,61],[2930,46],[3050,37],[3160,28],
  [3400,11],[3650,-5],[3900,-15],[4060,-19],[4380,-23],
  [4520,-24],[4660,-27],[4820,-32],[5040,-36],[5180,-33],
  [5700,-19],[6070,-9],[6220,-5],[6550,-5],[6570,-5],
  [6600,-4],[6670,-1.7],[6720,0],[6760,0],[7004,0],
];

// Shape-preserving Hermite slopes avoid both overshoot and the artificial
// flattening at every intermediate native elevation anchor.
const secants = SPA_ELEVATION.slice(1).map(([x,y],i)=>(y-SPA_ELEVATION[i][1])/(x-SPA_ELEVATION[i][0]));
const slopes = SPA_ELEVATION.map((_,i)=>{
  if(i===0 || i===SPA_ELEVATION.length-1) return 0;
  const a=secants[i-1],b=secants[i];
  if(a*b<=0) return 0;
  const before=SPA_ELEVATION[i][0]-SPA_ELEVATION[i-1][0],after=SPA_ELEVATION[i+1][0]-SPA_ELEVATION[i][0];
  const w1=2*after+before,w2=after+2*before;
  return (w1+w2)/(w1/a+w2/b);
});
export function spaElevation(distance:number):{height:number;grade:number} {
  const d=((distance%7004)+7004)%7004;
  let i=0;while(i<SPA_ELEVATION.length-2&&SPA_ELEVATION[i+1][0]<d)i++;
  const [x,a]=SPA_ELEVATION[i],[end,b]=SPA_ELEVATION[i+1],h=end-x,t=(d-x)/h;
  const m=slopes[i]*h,n=slopes[i+1]*h,c=3*(b-a)-2*m-n,e=2*(a-b)+m+n;
  return {height:a+t*(m+t*(c+t*e)),grade:(m+t*(2*c+3*e*t))/h};
}

/** Web-owned reconstruction: applied to fresh exports at load time, so syncing
 * iOS data cannot silently erase this profile. Never mutates the imported JSON. */
export function prepareSpaTerrain(source:NativeCircuit):NativeCircuit {
  const data=structuredClone(source),count=data.points.length-1;
  // The generic scenery has been replaced. Its old circular building proxies
  // would otherwise leave invisible obstacles in now-empty trackside grass.
  // New facilities stay outside the driving corridor and are visual-only.
  data.obstacles=[];
  data.surface=data.surface.map((s,i)=>{
    const p=spaElevation(data.distances[i]);return [p.height,p.grade,s[2],s[3]];
  });
  const deltas=data.surface.map((s,i)=>s[0]-source.surface[i][0]);
  function nearest(x:number,z:number) {
    let best=Infinity,index=0,fraction=0;
    for(let i=0;i<count;i++){
      const a=data.points[i],b=data.points[i+1],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
      const d=(x-a[0]-dx*t)**2+(z-a[1]-dz*t)**2;
      if(d<best){best=d;index=i;fraction=t;}
    }
    return {distance:Math.sqrt(best),i:index,t:fraction,delta:deltas[index]*(1-fraction)+deltas[index+1]*fraction};
  }
  const field=data.terrain;
  field.heights=field.heights.map((height,k)=>{
    const x=field.minX+k%field.columns*field.spacing,z=field.minZ+Math.floor(k/field.columns)*field.spacing;
    const near=nearest(x,z);
    // Broad wooded ridges outside the driving corridor; fade at the grid edge.
    const edge=Math.min(k%field.columns,field.columns-1-k%field.columns,Math.floor(k/field.columns),field.rows-1-Math.floor(k/field.columns));
    const fade=Math.min(1,Math.max(0,(near.distance-80)/150))*Math.min(1,edge/3);
    const ridge=(Math.sin(x/230+z/390)*5+Math.sin(z/170)*3)*fade;
    return height+near.delta+ridge;
  });
  for(const side of ['sceneryLeft','sceneryRight'] as const) {
    field[side]=field[side].map(([x,,z])=>[x,terrainHeight(field,x,z),z]);
  }
  const f=data.fence;
  field.fenceHeights=field.fenceHeights.map((height,i)=>{
    const angle=i/(field.fenceHeights.length-1)*Math.PI*2;
    const x=f.centerX+Math.cos(angle)*f.radius,z=f.centerZ+Math.sin(angle)*f.radius;
    return height+terrainHeight(field,x,z)-terrainHeight(source.terrain,x,z);
  });
  for(const wall of data.corridor.barriers) {
    for(const [p,key] of [[wall.a,'heightA'],[wall.b,'heightB']] as const){
      const near=nearest(p.x,p.z);
      wall[key]+=near.distance<100?near.delta:terrainHeight(field,p.x,p.z)-terrainHeight(source.terrain,p.x,p.z);
    }
  }
  // Spa has no escape-area polygons today; preserve consistent heights if an
  // upstream export later supplies one, rather than leaving the old elevation.
  for(const area of data.corridor.escapeAreas??[]){
    const p=area.polygon[0];if(p)area.height+=nearest(p.x,p.z).delta;
  }
  return data;
}
