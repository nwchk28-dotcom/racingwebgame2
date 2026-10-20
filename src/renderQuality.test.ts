import {expect,it} from 'vitest';
import {RenderQuality} from './renderQuality';
function feed(q:RenderQuality,now:number,seconds:number,fps:number){
 for(let i=0;i<Math.round(seconds*fps);i++)q.sample(now+=1000/fps);
 return now;
}
it('keeps native resolution at 60 fps and ignores an isolated dropped frame',()=>{
 const q=new RenderQuality(1.35);let now=feed(q,1,4,60);
 now+=34;q.sample(now);feed(q,now,4,60);
 expect(q.pixelRatio).toBe(1.35);
});
it('reduces fill rate under sustained load, within the readable lower bound',()=>{
 const q=new RenderQuality(1.35);
 feed(q,1,12,30);
 expect(q.pixelRatio).toBe(1);
 const lowDpi=new RenderQuality(.8);feed(lowDpi,1,12,30);expect(lowDpi.pixelRatio).toBe(.8);
});
it('recovers slowly instead of changing resolution on every frame',()=>{
 const q=new RenderQuality(1.35);let now=feed(q,1,5,30),low=q.pixelRatio;
 now=feed(q,now,4,60);expect(q.pixelRatio).toBe(low);
 feed(q,now,15,60);expect(q.pixelRatio).toBeGreaterThan(low);expect(q.pixelRatio).toBeLessThanOrEqual(1.35);
});
it('excludes app background pauses and resets measurements on resume',()=>{
 const q=new RenderQuality(1.35);let now=feed(q,1,1,30);
 q.reset();now+=30000;q.sample(now);feed(q,now,4,60);
 expect(q.pixelRatio).toBe(1.35);
});
