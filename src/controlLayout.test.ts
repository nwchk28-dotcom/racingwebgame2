import { expect, it } from 'vitest';
import { placementStyle } from './controlLayout';
it('clamps scaled button edges inside the viewport, including enlarged pedals',()=>{
  const size={width:94,height:135},p={x:1,y:1,scale:1.6,opacity:.4};
  const style=placementStyle(p,size,844,390),left=parseFloat(style.left),top=parseFloat(style.top);
  expect(left+size.width/2+size.width*p.scale/2).toBeCloseTo(836);
  expect(top+size.height/2+size.height*p.scale/2).toBeCloseTo(382);
  expect(style.width).toBe('94px');expect(style.height).toBe('135px');expect(style.opacity).toBe('0.4');
});
it('retains the actual button aspect ratio and uses one placement for edit and play',()=>{
  const p={x:.25,y:.7,scale:1.25,opacity:.8},size={width:148,height:98};
  expect(placementStyle(p,size,844,390)).toEqual({position:'fixed',left:'137px',top:'224px',width:'148px',height:'98px',flex:'none',transform:'scale(1.25)',opacity:'0.8',transformOrigin:'center'});
});
