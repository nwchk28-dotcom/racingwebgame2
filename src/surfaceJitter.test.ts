import { expect, it } from 'vitest';
import { loadNativeCircuit } from './nativeCircuit';
import { TRACKS } from './trackData';
import { TrackPath } from './trackPath';
it('keeps gradients continuous across road sample boundaries',async()=>{
 for(const id of ['spa','zandvoort','suzuka']){
  await loadNativeCircuit(id);const p=new TrackPath(TRACKS.find(t=>t.id===id)!);let max=0;
  for(let i=1;i<p.sampleCount-1;i++){
   const a=p.samples[i-1],b=p.samples[i],c=p.samples[i+1],eps=1e-5;
   const before=p.surfaceAt(b.x+(a.x-b.x)*eps,b.z+(a.z-b.z)*eps,p.distances[i]/p.length);
   const after=p.surfaceAt(b.x+(c.x-b.x)*eps,b.z+(c.z-b.z)*eps,p.distances[i]/p.length);
   max=Math.max(max,Math.hypot(before.gradientX-after.gradientX,before.gradientZ-after.gradientZ));
  }
  expect(max, id).toBeLessThan(.0001);
 }
});
