import { beforeAll, expect, it } from 'vitest';
import { loadNativeCircuit } from './nativeCircuit';
import { TrackPath } from './trackPath';
import { TRACKS } from './trackData';
beforeAll(async()=>{await Promise.all(TRACKS.map(t=>loadNativeCircuit(t.id)));});
it.each(['spa','suzuka','zandvoort'])('%s uses the actual surface gradient beyond both curbs',id=>{
 const path=new TrackPath(TRACKS.find(t=>t.id===id)!);let maxError=0;
 for(let i=30;i<path.sampleCount-30;i+=37){
  const a=path.samples[i],b=path.samples[i+1],n=path.normals[i].clone().lerp(path.normals[i+1],.37),progress=(path.distances[i]+.37*(path.distances[i+1]-path.distances[i]))/path.length;
  for(const side of [-1,1]){
   const u=side*(path.curbOuterEdgeAt(progress)+.4),x=a.x+(b.x-a.x)*.37+n.x*u,z=a.z+(b.z-a.z)*.37+n.z*u;
   const s=path.surfaceAt(x,z,progress),eps=.001;
   const dx=(path.surfaceAt(x+eps,z,progress).height-path.surfaceAt(x-eps,z,progress).height)/(2*eps);
   const dz=(path.surfaceAt(x,z+eps,progress).height-path.surfaceAt(x,z-eps,progress).height)/(2*eps);
   maxError=Math.max(maxError,Math.hypot(s.gradientX-dx,s.gradientZ-dz));
  }
 }
 expect(maxError).toBeLessThan(.002);
});

it.each(TRACKS)('$id has continuous contact from the road through both curbs to its guardrails',definition=>{
 const path=new TrackPath(definition),r=path.ribbon!,d=path.native;
 let maxHeightError=0,maxGradientError=0;
 for(let i=20;i<path.sampleCount-20;i+=43){
  const t=.37,width=d.widths[i]*(1-t)+d.widths[i+1]*t,curb=width+d.curbWidth;
  const left=d.corridor.left[i]*(1-t)+d.corridor.left[i+1]*t,right=d.corridor.right[i]*(1-t)+d.corridor.right[i+1]*t;
  for(const u of [-right+.1,-curb-.1,-curb+.1,-width-.1,-width+.1,0,width-.1,width+.1,curb-.1,curb+.1,left-.1]){
   const p=r.at(i,t,u),actual=path.surfaceAt(p.x,p.z,p.progress);
   const separation=Math.abs(actual.progress-p.progress);
   expect(Math.min(separation,1-separation)*path.length,`${definition.id} ${i} ${u}`).toBeLessThan(.01);
   maxHeightError=Math.max(maxHeightError,Math.abs(actual.height-p.height));
   maxGradientError=Math.max(maxGradientError,Math.hypot(actual.gradientX-p.gradientX,actual.gradientZ-p.gradientZ));
  }
 }
 expect(maxHeightError).toBeLessThan(.001);expect(maxGradientError).toBeLessThan(.002);
});
