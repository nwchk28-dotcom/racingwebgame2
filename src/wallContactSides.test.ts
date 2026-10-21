import {expect,it} from 'vitest';
import {TrackWalls} from './trackWalls';
import type {TrackPath} from './trackPath';
function wall(twoSided=false){
 return new TrackWalls({native:{corridor:{barriers:[{a:{x:0,z:-10},b:{x:0,z:10},inward:{x:1,z:0},heightA:0,heightB:0,twoSided}]}}} as unknown as TrackPath,1);
}
it('does not pull a car several metres toward the back of a neighbouring rail',()=>{
 expect(wall().contact(-3,0,.35,0,-3,0)).toBeNull();
});
it('still pushes a wheel back to its own road after it crosses a rail',()=>{
 const hit=wall().contact(-.1,0,.35,0,2,0)!;
 expect(hit.normalX).toBe(1);expect(hit.depth).toBeCloseTo(.45);
});
it('retains the approach side when crossing a two-sided divider in either direction',()=>{
 for(const direction of [-1,1]){
  const hit=wall(true).contact(-direction*.1,0,.35,0,direction*2,0)!;
  expect(hit.normalX).toBe(direction);expect(hit.depth).toBeCloseTo(.45);
 }
});
